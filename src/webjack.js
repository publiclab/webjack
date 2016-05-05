WebJack.Connection = Class.extend({

  init: function(args) {

    var connection = this;

    connection.args = args; // connection.args.baud_rate, etc


    // an object containing two histories -- 
    // sent commands and received commands
    connection.history = {

      // oldest first:
      sent: [],

      // oldest first:
      received: []

    }


    // Sends request for a standard data packet
    connection.get = function(data) {

    }


    // Sends data to device
    connection.send = function(data) {

      connection.history.sent.push(data);

    }


    // Listens for data packets and runs 
    // passed function listener() on results
    connection.listen = function(listener) {

      // connection.history.received.push(data);
      // listener(data);

    }    


    // Returns valid JSON object if possible, 
    // or <false> if not.
    connection.validateJSON = function(data) {

    }


  } 

});
