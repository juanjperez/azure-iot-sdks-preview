// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
'use strict';

var Registry = require('azure-iothub').Registry;
var Client = require('azure-iothub').Client;

// receive the IoT Hub connection string as a command line parameter
if(process.argv.length < 4) {
    console.error('Usage: node dmpatterns_reboot_service.js <<IoT Hub Connection String>> <<targetDeviceId>>');
    process.exit(1);
}
 
var connectionString = process.argv[2];
var registry = Registry.fromConnectionString(connectionString);
var client = Client.fromConnectionString(connectionString);
var deviceToReboot = process.argv[3];

//
// Service entry point: Initiate the reboot process on the device using a device method
//
function main() {
  // Invoke the 'reboot' method on the device
  var methodParams = {
      methodName: "reboot",
      payload: null,
      timeoutInSeconds: 10
  };

  // call a method on the device to reboot the device
  client.invokeDeviceMethod(deviceToReboot, methodParams, function(err, result) {
    if (err) { 
      console.error("Direct method error: "+err.message);
    } else {
      console.log("Successfully invoked the device to reboot.");  
    }
  });

  showTwinLastRebootForever(function(err) {
    if (err) {
      console.error("Error showing twin: "+err);
    } 
  });
}

// 
// function used to periodically query for the lastReboot time
//
var showTwinLastRebootForever = function(callback) {
  // Output the status of the firmware update periodically
  setInterval(function() {
    // Get the twin that has the updated lastReboot time
    registry.getTwin(deviceToReboot, function(err, twin){

      if (twin.properties.reported.iothubDM != null)
      {
        if (err) {
          console.error('Could not query twins: ' + err.constructor.name + ': ' + err.message);
          callback(err);
        } else {
          
          // The device uses the DM pattern to report the status
          // of the reboot.  This simplifies reporting against many devices.
          var lastRebootTime = twin.properties.reported.iothubDM.reboot.lastReboot;
          console.log('Last reboot time: ' + JSON.stringify(lastRebootTime, null, 2));
          callback(null);
        }
      } else 
        console.log('Waiting for device to report last reboot time.');
        callback(null);
    });
  }
  , 2000);
}

main();


