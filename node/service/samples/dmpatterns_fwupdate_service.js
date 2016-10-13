// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
'use strict';

var Registry = require('azure-iothub').Registry;
var Client = require('azure-iothub').Client;


// receive the IoT Hub connection string as a command line parameter
if(process.argv.length < 4) {
    console.error('Usage: node dmpatterns_fwupdate_service.js <<IoT Hub Connection String>> <<targetDeviceId>>');
    process.exit(1);
}
 
var connectionString = process.argv[2];
var registry = Registry.fromConnectionString(connectionString);
var client = Client.fromConnectionString(connectionString);
var deviceToUpdate = process.argv[3];

//
// Service entry point: Initiate the firmware update process on the device using a device method
//
function main() {
    // Pass the firmware image url to the device through the params object
    var params = {
        fwPackageUri: 'https://secureurl'
    };

    // Invoke the 'firmwareUpdate' method on the device
    var methodParams = {
        methodName: "firmwareUpdate",
        payload: params,
        timeoutInSeconds: 30
    };

    client.invokeDeviceMethod(deviceToUpdate, methodParams, function(err, result) {
        
        if (err) {
            console.error('Could not start the firmware update on the device: ' + err.message)
        } else {
            console.log('Method (firmwareUpdate) result: '+result.payload);
        }
        
    });

    // Output the status of the firmware update every 1 second.  
    queryTwinFWUpdateReportedForever(function(err) {
        if (err) {
            console.error("Error showing twin: "+err);
        } 
    });
}

// 
// Called periodically to get the twin and output the firmwareUpdate status from reported properties
//
function queryTwinFWUpdateReportedForever(callback) {
    
    // repeat every 1 second.  This is only used for this sample, in your back-end application, you can
    // query for progress when refreshing your dashboard.    
    setInterval(function() {
        registry.getTwin(deviceToUpdate, function(err, twin){
            if (err) {
                console.error('Could not query twins: ' + err.constructor.name + ': ' + err.message);
                callback(err);
            } else {
                
                // Output the value of the firmwareUpdate object, if it's present on the twin.
                if (twin.properties.reported.iothubDM != null)
                    console.log(JSON.stringify(twin.properties.reported.iothubDM.firmwareUpdate, null, 2) + "\n");
                    
                callback(null);
            }
        });
    },
    1000);

};
 
main();

