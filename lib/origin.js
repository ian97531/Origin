"use strict";

var und = require('underscore');


/*
   Function: extend
   Takes a constructor and a dictionary containing an initializer function,
   a properties dictionary, and a classProperties dictionary and creates a new
   constructor that will make objects with the provided initializer and properties
   and that will inherit from the given parent

   Parameters:
      parent - A constructor
      options - A dictionary containing an initializer function, a properties 
      dictionary, and a classProperties dictionary

   Returns:
       A new constructor that will make objects with the provided initializer and properties
       and that will inherit from the given parent
*/
function extend(parent, options) {

  // Create a new prototype from the parent provided
  var prototype = Object.create(parent && parent.prototype);
  
  // Get the values passed in options, or setup their defaults.
  var properties      = (options && options.properties) ? options.properties : {};
  var classProperties = (options && options.classProperties) ? options.classProperties : {};
  var constructor     = (options && options.initializer) ? options.initializer : function() {
    if (parent && parent.prototype && parent.prototype.constructor) {
      parent.prototype.constructor.apply(this, arguments);
    }
  };
  
  // If methods were supplied, copy them into the new prototype
  prototype.constructor = constructor;
  Object.keys(properties).forEach(function(key) {
    prototype[key] = properties[key];
  });
  
  
  // Create the constructor function 
  var constructorFunc = function() {
    // Copy the methods into the object so that they're available
    // for the constructor.
    Object.keys(prototype).forEach(function(key) {
      this[key] = prototype[key];
    }, this);
    
    constructor.apply(this, arguments);
  };

  // Copy the parent's class methods down if they're not already
  // defined for this class via options.
  Object.keys(parent).forEach(function(key) {
    if (classProperties[key] === undefined) {
      constructorFunc[key] = parent[key];
    }
  });
  
  // Copy in the class methods passed in via options
  Object.keys(classProperties).forEach(function(key) {
    constructorFunc[key] = classProperties[key];
  });

  // Set the prototype of the constructor function
  // to be the prototype we just created.
  prototype.constructor._class = constructorFunc;
  prototype.constructor._class._parent = parent;
  constructorFunc.prototype = prototype;
  return constructorFunc;
}


exports = extend(Object, {
  properties: {
    
    /*
       Function: parent
       Creates a dictionary of method shims for each method available in the ancestor
       that will call the corresponding method in the ancestor with the correct context.

       Parameters:
          x - An ancestor constructor

       Returns:
          A dictionary of method shims for each method available in the ancestor.
    */
    parent: function(cls) {

      // An internal shim builder function because we don't have the let keyword.
      function createShims(prototype, context) {
        
        // If the property is a function, create a call pass back
        // a function that will call it with the correct context,
        // and pass along any arguments suppled
        var shims = {};
        Object.keys(prototype).forEach(function(key) {
          var property = prototype[key];
          if (property instanceof Function) {
            shims[key] = function() {
              return property.apply(context, arguments);
            };
          }
          // Otherwise, just return the property.
          else {
            shims[key] = property;
          }
        });
        return shims;
      }
      
      var methodShims = {};
      var prototype = false;

      // Make sure the supplied constructor has a prototype
      if (cls && cls.prototype) {

        // Find the constructor in the current object's prototype chain, 
        // save aside it's prototype and all of it's ancestor's prototypes.
        var foundConstructor = false;
        var prototypeList = [];
        
        // Crawl up the prototype chain
        prototype = Object.getPrototypeOf(this);
        while(prototype) {
          // Look for the constructor that matches the supplied constructor
          foundConstructor = foundConstructor || (prototype.constructor === cls.prototype.constructor);
          
          // We want to save all of the prototype the constructor passed in and
          // all of it's ancestors.
          if (foundConstructor) { prototypeList.push(prototype); }
          
          // Grab the next parent's prototype for the next run through the while loop.
          prototype = Object.getPrototypeOf(prototype);
        }
        
        // If we didn't find the supplied constructor, that means that this
        // object is not a subclass of that constructor.
        if(!foundConstructor) {
          throw "The constructor given to parent() is not an ancestor of this object.";
        }

        // If we found the constructor in the prototype chain,
        // build the method shims for that constructor's prototype properties
        // and it's ancestor's properties.
        prototype = prototypeList.pop();
        while (prototype) {
          und.extend(methodShims, createShims(prototype, this));
          prototype = prototypeList.pop();
        }

      }

      // Return the shim methods
      return methodShims;
    },
    
    /*
       Function: cls
       Gets the constructor for the object.

       Returns:
          The constructor for the object.
    */
    cls : function() {
      return this.constructor._class;
    }
    
  },
  
  classProperties: {
    
    /*
       Function: extend
       A class method that allows one to create sub-classes for any descendant of Root.

       Parameters:
          childOptions - A dictionary specifying an initializer function, a properties
          dictionary, and a classProperties dictionary

       Returns:
          A constructor that creates objects with the specified initializer function
          and properties that inherits from the 'class' that extend was called on.
    */
    extend: function(childOptions) {
      return extend.apply(null, [this, childOptions]);
    },
    
    
    /*
       Function: inheritsFrom
       Test whether this 'class' is a subclass of the given class.

       Parameters:
          cls - A constructor

       Returns:
          A boolean value indicating if this class is a subclass of the given class.
    */
    inheritsFrom: function(cls) {
      if (!cls || !cls.prototype) {
        return false;
      }
      
      var ancestorConstructor = cls.prototype.constructor;
      var currentPrototype = this.prototype;
      
      while(currentPrototype) {
        if (currentPrototype.constructor === ancestorConstructor) {
          return true;
        }
        currentPrototype = Object.getPrototypeOf(currentPrototype);
      }
      
      return false;
    },
    
    
    /*
       Function: superclass
       Returns the direct parent class or the given class if the given class is
       in the current class's ancestor chain.

       Returns:
          A parent constructor or false.
    */
    superclass : function() {
      return this._parent;
    }
  }
});




