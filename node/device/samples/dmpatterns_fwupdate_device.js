// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
'use strict';

var Client = require('azure-iot-device').Client;
var Protocol = require('azure-iot-device-mqtt').Mqtt;
var url = require('url');
var async = require('async');

// receive the IoT Hub device connection string as a command line parameter
if(process.argv.length < 3) {
    console.error('Usage: node dmpatterns_fwupdate_device.js <<IoT Hub Device Connection String>>');
    process.exit(1);
}

var connectionString = process.argv[2];
var client = Client.fromConnectionString(connectionString, Protocol);

// The handler for the firmwareUpdate method.  This initiates
// the multi-phase firmware update sequence.
function onFirmwareUpdate(request, response) {
  // Get the firmware image Uri from the body of the method request
  var fwPackageUri = request.payload.fwPackageUri;
  var result = url.parse(fwPackageUri);
  
  // Ensure that the url is to a secure url
  if (result.protocol != 'https:') {
    response.send(400, 'Invalid URL format.  Must use https:// protocol.', function(err) {
      if (err) console.error('Error sending method response :\n' + err.toString());
      else console.log('Response to method \'' + request.methodName + '\' sent successfully.');
    });
  } else {
    // Respond the cloud app for the device method
    response.send(200, 'Firmware update started.', function(err) {
      if (err) console.error('Error sending method response :\n' + err.toString());
      else console.log('Response to method \'' + request.methodName + '\' sent successfully.');
    });

    initiateFirmwareUpdateFlow(fwPackageUri, function(err){
      if (!err) console.log("Completed firmwareUpdate flow");
    });
  }
}

// Implementation of firmwareUpdate flow
function initiateFirmwareUpdateFlow(fwPackageUri, callback) {
  async.waterfall([
    function (callback) {
      downloadImage(fwPackageUri, callback);
    },
    function (imageData, callback) {
      applyImage(imageData, callback);
    }
  ], function(err) {
    if (err) console.error('Error : ' + err.message);
    callback(null);
  });
}

// Helper function to update the twin reported properties.
// Used by every phase of the firmware update.
function reportFWUpdateThroughTwin(firmwareUpdateValue, callback) {
  var patch = {
      iothubDM : {
        firmwareUpdate : firmwareUpdateValue
      }
  };
  console.log(JSON.stringify(patch, null, 2));
  client.getTwin(function(err, twin) {
    if (!err) {
      twin.properties.reported.update(patch, function(err) {
        callback(null);
      });      
    } else
      callback(err);
  });
};

// Function that implements the 'downloadImage' phase of the 
// firmware update process.
function downloadImage(fwPackageUriVal, callback) {
  var imageResult = '[Fake firmware image data]';
  
  async.waterfall([
    function (callback) {
      reportFWUpdateThroughTwin ({ 
        status: 'downloading',
        startedDownloadingTime: new Date().toISOString()
      }, 
      callback);
    },
    function (callback) {
      // Replace this line with the code to download the image.  Delay used to simulate the download.
      setTimeout(function() { 
        console.log("Downloading image from URI: " + fwPackageUriVal);
        callback(null, imageResult); 
      }, 4000);
    },
    function (image, callback) {
      reportFWUpdateThroughTwin ({ 
        status: 'download complete',
        downloadCompleteTime : new Date().toISOString()
      }, 
      callback);
    },
  ],
  function(err) {
    if (err) {
      reportFWUpdateThroughTwin( { status : 'Download image failed' }, function(err) {
        callback(err);  
      })
    }
    callback(null, imageResult);
  });
}

// Implementation for the apply phase, which reports status after 
// completing the image apply.
function applyImage(imageData, callback) {
  async.waterfall([
    function(callback) {
      reportFWUpdateThroughTwin ({ 
        status: 'applying',
        startedApplyingImage: new Date().toISOString()
      }, 
      callback);
    },
    function (callback) {
      // Replace this line with the code to download the image.  Delay used to simulate the download.
      setTimeout(function() { 
        console.log("Applying firmware image"); 
        callback(null);
      }, 4000);      
    },
    function (callback) {
      reportFWUpdateThroughTwin ({ 
        status: 'apply firmware image complete',
        lastFirmwareUpdate: new Date().toISOString()
      }, 
      callback);
    },
  ], 
  function (err) {
    if (err) {
      reportFWUpdateThroughTwin({ status : 'Apply image failed' }, function(err) {
        callback(err);  
      })
    }
    callback(null);
  })
}

client.open(function(err) {
  if (!err) {
    client.onDeviceMethod('firmwareUpdate', onFirmwareUpdate);
    console.log('Client connected to IoT Hub.  Waiting for firmwareUpdate device method.');
  }
});
