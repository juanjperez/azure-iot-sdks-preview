// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var uuid = require('uuid');
var assert = require('chai').assert;

var serviceSdk = require('azure-iothub');
var createDeviceClient = require('./testUtils.js').createDeviceClient;
var closeDeviceServiceClients = require('./testUtils.js').closeDeviceServiceClients;
var eventHubClient = require('azure-event-hubs').Client;
var Message = require('azure-iot-common').Message;

function waitForEventHubMessages(ehClient, deviceId, callback) {
  var monitorStartTime = Date.now();
  ehClient.open()
    .then(ehClient.getPartitionIds.bind(ehClient))
    .then(function (partitionIds) {
      return partitionIds.map(function (partitionId) {
        return ehClient.createReceiver('$Default', partitionId,{ 'startAfterTime' : monitorStartTime}).then(function(receiver) {
          receiver.on('errorReceived', function(err) {
            callback(err);
            callback = null;
          });
          receiver.on('message', function (eventData) {
            if (eventData.systemProperties['iothub-connection-device-id'] === deviceId) {
              receiver.removeAllListeners();
              callback(null, eventData);
              callback = null;
            }
          });
        });
      });
    })
    .catch(function (error) {
      callback(error.message);
      callback = null;
    });
}
 

var runTests = function (hubConnectionString, deviceTransport, provisionedDevice) {
  describe('Device utilizing ' + provisionedDevice.authenticationDescription + ' authentication and ' + deviceTransport.name, function () {

    var serviceClient, deviceClient, ehClient;

    before(function() {
      this.timeout(500);
      
      // Amqp-ws is broken for this scenario.  It just doesn't work.
      if (deviceTransport.name === 'AmqpWs') this.skip();

      // Amqp is broken.  It works mostly, but fails intermittently.
      // Mocha reports "Uncaught Error: AMQP Transport: Could not connect", but 
      // sometimes, this exception fires during another test, so you see spurious 
      // failures in other tests because of Amqp exceptions lingering about from
      // previous tests.
      if (deviceTransport.name === 'Amqp') this.skip();
    });

    beforeEach(function () {
      this.timeout(5000);
      
      serviceClient = serviceSdk.Client.fromConnectionString(hubConnectionString);
      deviceClient = createDeviceClient(deviceTransport, provisionedDevice);
      ehClient = eventHubClient.fromConnectionString(hubConnectionString);
    });

    afterEach(function (done) {
      this.timeout(20000);
      
      var closeError;
      closeDeviceServiceClients(deviceClient, serviceClient, function(err) {
        closeError = err;
        if (ehClient) {
          ehClient.close()
            .then(function() {
              done(closeError);
            })
            .catch(function(err) {
              done(closeError || err);
            });
        } else {
          done(closeError);
        }
      });
     });

    it('Device renews SAS after connection and is still able to receive C2D', function (done) {
      this.timeout(20000);
      var messageToSend = new Message(uuid.v4());
      messageToSend.expiryTimeUtc = Date.now() + 60000; // Expire 60s from now, to reduce the chance of us hitting the 50-message limit on the IoT Hub

      deviceClient.open(function (err) {
        if (err) return done(err);

        var foundTheMessage;
        
        deviceClient.on('message', function (msg) {
            if (msg.data.toString() === messageToSend.data.toString()) {
              foundTheMessage = true;
              deviceClient.removeAllListeners('message');
            }

            deviceClient.complete(msg, function (err, result) {
              if (err) return done(err);
              assert.equal(result.constructor.name, 'MessageCompleted');
              if (foundTheMessage) {
                done();
              }
            });
        });

        deviceClient.on('_sharedAccessSignatureUpdated', function() {
          setTimeout(function() {
            serviceClient.open(function (err) {
              if (err) return done(err);
              serviceClient.send(provisionedDevice.deviceId, messageToSend, function (err) {
                if (err) return done(err);
              });
            },1000);
          });
        });

        deviceClient._renewSharedAccessSignature();
      });
    });

    it ('Device renews SAS after connection and is still able to send messages', function(done) {
      // For Amqp, the test passes, but deviceClient.sendEvent never calls it's done function
      // and the afterEach function times out.
      if (deviceTransport.name === 'Amqp') this.skip();

      this.timeout(20000);
      var bufferSize = 1024;
      var buffer = new Buffer(bufferSize);
      var uuidData = uuid.v4();
      buffer.fill(uuidData);

      deviceClient.open(function (err) {
        if (err) return done(err);

        waitForEventHubMessages(ehClient, provisionedDevice.deviceId, function(err, eventData) {
          if (err) return done(err);
          if ((eventData.body.length === bufferSize) && (eventData.body.indexOf(uuidData) === 0)) {
            done();
          }
        });

        deviceClient.on('_sharedAccessSignatureUpdated', function() {
          setTimeout(function() { 
            var message = new Message(buffer);
            deviceClient.sendEvent(message, function (sendErr) {
              if (sendErr) {
                done(sendErr);
              }
            });
          }, 1000);
        });
        deviceClient._renewSharedAccessSignature();
      });
    });
  });
    

};
   
module.exports = runTests;


