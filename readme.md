Origin
=============

This library provides an easily extendable base class that comes with some very convenient built-in instance methods and class methods.
It differs from other implementations of extend in that it makes adding class methods very easy and provides a parent() method that
makes calling methods from parent classes easy and reliable.

Installation
------------

    npm install origin

Quick Start/Example
-----------

    var Origin = require('origin');
    
    // Use the extend class method on Origin or any subclass of
    // origin to create a new class.
    var MyClass = Origin.extend({
      
      // This function will become the constructor for your
      // new class
      initializer: function(arg1, arg2) {
        ...
      },
      
      // You can define the variables and methods that will be
      // present in each instance of your new class. Sublasses
      // of this class, created using MyClass.extend() will
      // persist these these properties unless they are overridden
      // by the subclass.
      properties : {
        
        someVariable : "some value",
        
        someFunction : function(arg1, arg2) {
          
          // All instances have a cls method that will return
          // the class of the object.
          if (arg1 instanceof this.cls()) {
            ...
          }
          
        }
        
        someOtherFunction : function(arg1) {
          
          // All objects that extend from Origin have a parent
          // method that allows you to call a method of any parent
          // class.
          this.parent(AncestorClass).someOtherFunction(arg1);
          ...
  
        }
      },
      
      classProperties : {
        
        // You can easily attach class methods to any class you define.
        // Subclasses of this class, created with MyClass.extend(), will
        // persist these class methods unless they're overriden by a 
        // subclass.
        aClassMethod : function(arg1) {
          ...
        }
      }
    });
    
    var myClassInstance = new MyClass(arg1, arg2);


The Origin Class
--------------

    + extend({ initializer : function() { ... }, 
               properties : { ... },
               classMethods : { ... }
             });
     
    Exactly as Origin.extend() allows you to create a subclass of Origin, 
    calling extend on any class you create will allow you to subclass 
    that class. Extend() takes a single dictionary that may contain an
    "initializer" function (the constructor for the resulting class),
    a "properties" object containing values or methods to attach to instances
    of your new class, and a "classProperties" object that contains any
    class methods that you'd like attached to your new class.


    + inheritsFrom(cls);
    
    This returns true if the class you're calling inheritsFrom on is a subclass
    of the class that you pass in as an argument. Returns false otherwise.
    
    
    + superclass();
    
    Returns the parent class.
    
    
    - parent(cls);
    
    Takes a superclass of the current object's class and returns a dictionary
    with methods corresponding to the methods available in that superclass.
    Calling one of those methods behaves as expected and maintains the correct
    context of 'this'.
    
    
    - cls();
    
    Returns the class of the current object.


License
-------------------

Released under the MIT license.  See file called LICENSE for more
details.
