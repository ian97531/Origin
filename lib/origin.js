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


var Base = extend(Object, {
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
          var shims = createShims(prototype, this);
          Object.keys(shims).forEach(function(key) {
            methodShims[key] = shims[key];
          });
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




var Responder = Base.extend({
  
  initializer: function() {
    this._responderCallbacks = {};
    this._responderBindings = [];
  },
  
  properties: {
    
    /*
       Function: on
       Registers a callback for an event. When trigger is called on this object
       and passed the same eventName, all callbacks registered using the on
       function for the eventName will be called and passed an event object.

       Parameters:
          eventName - A String event name
          callback - A function to be called when the eventName is triggered
          context - (Optional) An object to be used as the context for the callback

       Returns:
          A boolean value. True if the callback was registered, false if the callback
          already exists.
    */
    on: function(eventName, callback, context) {
      eventName = eventName || "all";
      
      if (callback) {
        if (!this._responderCallbacks[eventName]) {
          this._responderCallbacks[eventName] = [];
        }
        
        // Check to see if this exact callback already exists. Having duplicate callbacks
        // isn't useful.
        var callbackExists = und.find(this._responderCallbacks[eventName], function(cb) {
          return (cb.callback === callback && cb.context === context);
        });
        
        if (!callbackExists) {
          this._responderCallbacks[eventName].push({callback: callback, context: context});
          return true;
        }
        return false;
      }
      return false;
    },
    
    /*
       Function: on
       Removes callbacks previous registered with the on method. If a given argument
       is ommitted, all callbacks matching the provided arguments will be removed.

       Parameters:
          eventName - (Optional) A String event name
          callback - (Optional) A function to be called when the eventName is triggered
          context - (Optional) An object to be used as the context for the callback

       Returns:
          A boolean value. True if a callback was found and removed, false otherwise.
    */
    off: function(eventName, callback, context) {
      var removes = [];
      var success = false;
      
      if(this._responderCallbacks[eventName] && callback) {
        removes = und.filter(this._responderCallbacks[eventName], function(cb) {
          return (cb.callback === callback && cb.context === context);
        }, this);
        
        if (removes.length) {
          this._responderCallbacks[eventName] = und.difference(this._responderCallbacks[eventName], removes);
          return true;
        }
        return false;
      }
      else if (this._responderCallbacks[eventName] && !callback && context) {
        removes = und.filter(this._responderCallbacks[eventName], function(cb) {
          return (cb.context === context);
        }, this);
        
        if (removes.length) {
          this._responderCallbacks[eventName] = und.difference(this._responderCallbacks[eventName], removes);
          return true;
        }
        return false;
      }
      else if (this._responderCallbacks[eventName] && !callback) {
        delete this._responderCallbacks[eventName];
        return true;
      }
      else if (!eventName && callback) {
        und.each(this._responderCallbacks, function(cbs, eventName) {
          success = this.off(eventName, callback) || success;
        }, this);
        return success;
      }
      else if (!eventName && !callback && context) {
        und.each(this._responderCallbacks, function(cbs, eventName) {
          success = this.off(eventName, null, context) || success;
        }, this);
        return success;
      }
      else if (!eventName && !callback && !context) {
        if (und.size(this._responderCallbacks)) {
          this._responderCallbacks = {};
          return true;
        }
        return false;
      }
      return false;
    },
    
    
    /*
       Function: bindTo
       Similar to the 'on' method, but called on the listening object rather
       than the triggered object. The benefit of 'bindTo' is that all callbacks
       can be removed using a single method 'unbindFromAll'. This is particularly
       useful when you're disposing of an object and want to remove all callbacks
       to that object to avoid a memory leak.

       Parameters:
          model - An object to bind to for the given event
          eventName - A String event name
          callback - A function to be called when the eventName is triggered
          context - (Optional) An object to be used as the context for the callback

       Returns:
          A boolean value. True if the callback was registered, false if the callback
          already exists.
    */
    bindTo: function(obj, eventName, callback, context) {
      if (obj.on(eventName, callback, context)) {
        this._responderBindings.push({obj: obj, eventName: eventName, callback: callback, context: context});
        return true;
      }
      return false;
    },
    
    
    /*
       Function: unbindFrom
       Removes bindings created with the bindTo method.

       Parameters:
          model - An object to remove the binding from
          eventName - A String event name
          callback - A function to be called when the eventName is triggered
          context - (Optional) An object to be used as the context for the callback

       Returns:
          A boolean value. True if the binding was removed, false otherwise.
    */
    unbindFrom : function(obj, eventName, callback, context) {
      if(obj.off(eventName, callback, context)) {
        var removals = [];
        und.each(this._responderBindings, function(binding) {
          if (binding.obj === obj && 
              binding.eventName === eventName && 
              binding.callback === callback && 
              binding.context === context) {
            removals.push(binding);
          }
        }, this);
        
        this._responderBindings = und.difference(this._responderBindings, removals);
        
        return (removals.length > 0);
      }
    },
    
    /*
       Function: unbindFromAll
       Removes all bindings that were created using bindTo. This is particularly useful
       when disposing of an object to avoid a memory leak.

       Returns:
          Returns true once all of the bindings are removed.
    */
    unbindFromAll : function() {
      und.each(this._responderBindings, function(binding) {
        binding.obj.off(binding.eventName, binding.callback, binding.context);
      });
      this._responderBindings = [];
      return true;
    },
    
    
    /*
       Function: trigger
       Triggers an event of the given name. Any listeners registered with the 'on'
       method for the same eventName will have their callbacks called.

       Parameters:
          eventName - A String event name
          eventData - Any data to be included in the event object passed to each callback.

    */
    trigger: function(eventName, eventData) {
      
      // Construct the event object
      var eventObject = {
        sender: this,
        name: eventName,
        payload: eventData
      };
      
      this.repeat(eventObject);
    },
    
    /*
       Function: repeat
       Takes an event object and will resend it to any listeners register
       with the 'on' method for the eventName specified in the event object.

       Parameters:
          event - An event object

    */
    repeat : function(event) {
      var eventCallbacks = this._responderCallbacks[event.name] || [];
      var allCallbacks = this._responderCallbacks['all'] || [];
      var callbacks = und.union(eventCallbacks, allCallbacks);
      if (callbacks.length) {

        // Pass the event to each of the callbacks for this event
        und.each(callbacks, function(cb) {
          var eventClone = und.clone(event);
          if (cb.context) {
            cb.callback.call(cb.context, eventClone);
          }
          else {
            cb.callback(eventClone);
          }
        });
      }
    } 
  }
  
});

exports.extend = extend;
exports.Base = Base;
exports.Responder = Responder;