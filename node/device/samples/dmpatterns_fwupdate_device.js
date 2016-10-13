// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
'use strict';

var Client = require('azure-iot-device').Client;
var Protocol = require('azure-iot-device-mqtt').Mqtt;
var url = require('url');

// receive the IoT Hub device connection string as a command line parameter
if(process.argv.length < 3) {
    console.error('Usage: node dmpatterns_fwupdate_device.js <<IoT Hub Device Connection String>>');
    process.exit(1);
}

var connectionString = process.argv[2];
var client = Client.fromConnectionString(connectionString, Protocol);

// device entry point
function main() {
  client.open(function(err) {
    if (err) {
      console.error('Could not connect to IotHub client');
    }  else {
      console.log('Client connected to IoT Hub.  Waiting for firmwareUpdate device method.');
    }
    
    // Subscribe to the 'firmwareUpdate' device method
    client.onDeviceMethod('firmwareUpdate', onFirmwareUpdate);
  });
}

// Implementation of firmwareUpdate flow
function initiateFirmwareUpdateFlow(fwPackageUri, callback) {
  
  // Obtain the device twin
  client.getTwin(function(err, twin) {
    if (err) {
      console.error('Could not get device twin.');
    } else {
      console.log('Device twin acquired.');
      
      // Start the multi-stage firmware update.  Each of these steps will update 
      // the device twin reported properties to enable back end applications 
      // to query for devices progressing through the different stages of a firmware 
      // update.  Update this sequence to change the phases of your firmware update
      // sequence.
      waitToDownload(err, twin, fwPackageUri, function(err) {
        if (err) {
          callback(new Error('waitToDownload failed'));
        }
        else {
          downloadImage(err, twin, fwPackageUri, function(err, imageData) {
            if (err) {
              callback(new Error('downloadImage failed'));
            } else {
              applyImage(err, twin, imageData, function(err) {
                if (err) {
                  callback(new Error('applyImage failed'));
                } else {
                  callback(null);
                }
              });    
            }
          });    
        }
        
      });

    }
  });      
}

// Helper function to update the twin reported properties.
// Used by every phase of the firmware update.
function reportFWUpdateThroughTwin(twin, firmwareUpdateValue, callback) {
  var patch = {
      iothubDM : {
        firmwareUpdate : firmwareUpdateValue
      }
  };
  
  twin.properties.reported.update(patch, function(err) {
    if (err) {
      callback(err);
    }
    else {
      console.log('twin state reported');
      console.log(JSON.stringify(patch,null, 2));
      callback(null);
    }
      
  });
};

// Placeholder for the download process of the firmware image from the URI passed as a parameter
function downloadImageData(imageUrl, callback) {
  var image = "[fake image data]";
  
  console.log("Downloading image from " + imageUrl);
  
  // The timeout is used for the simulation.  When implemented, the timeout
  // should be removed.
  setTimeout(function() { 
    callback(null, image); 
  }, 4000);
}

// Placeholder for applying the firmware image downloaded previously
function applyImageData(imageData, callback) {
  
  if (!imageData) {
    callback(new Error('Apply image failed because of missing image data'));
  }
  
  // The timeout is used for the simulation.  When implemented, the timeout
  // should be removed.
  setTimeout(function() { callback(null); }, 4000);
}

// Implementation for the waiting phase.  Upon receiving the firmwareUpdate
// method call, the device needs to decide for an appropriate time to started
// the process of downloading and applying the firmware image.  During that 
// waiting phase, the device uses the twin reported properties to inform the 
// back end that it is waiting. 
function waitToDownload(err, twin, fwPackageUriVal, callback) {
  
  reportFWUpdateThroughTwin(twin, {
    fwPackageUri: fwPackageUriVal,
    status: 'waiting',
    error : null,
    startedWaitingTime : new Date().toISOString()
  }, function(err) {
    if (err){
      console.error("Error: "+err)
      callback(err);
    } else {
      callback(null);
    }
  });
  
};

// Function that implements the 'downloadImage' phase of the 
// firmware update process.
function downloadImage(err, twin, fwPackageUriVal, callback) {
  
  reportFWUpdateThroughTwin(twin, 
    {
      status: 'downloading'
    }, 
    function(err) {
      if (err) {
        console.error("Error: "+err)
        callback(err);
      }
      else {
          // download the image
          downloadImageData(fwPackageUriVal, function(err, image) {
            
            if (err)
            {
              reportFWUpdateThroughTwin(twin, 
              {
                status: 'downloadfailed',
                error: {
                  code: error_code,
                  message: error_message,
                }
              }, 
              function(err)
              {
                if (err) {
                  console.error("Error: "+err);
                  callback(err);
                }
                else
                  callback(err);
              });
            }
            else {        
              reportFWUpdateThroughTwin(twin, 
              {
                status: 'downloadComplete',
                downloadCompleteTime: new Date().toISOString(),
              }, 
              function(err) {
                if (err) {
                  console.error("Error: "+err);
                  callback(err);
                } else 
                  callback(null, image); 
              });
              
            }
          });
      }
    }
  );
}
  

// Implementation for the apply phase, which reports status after 
// completing the image apply.
function applyImage(err, twin, imageData, callback) {
  
  reportFWUpdateThroughTwin(twin, 
  {
    status: 'applying',
    startedApplyingImage : new Date().toISOString()
  },
  function(err) {
    if (err) {
      console.error("Error: "+err)
      callback(err);
    } else {
      // Apply the image
      applyImageData(imageData, function(err) {
        if (err) {
          reportFWUpdateThroughTwin(twin, 
          {
            status: 'applyFailed',
            error: {
              code: err.error_code,
              message: err.error_message,
            }
          }, 
          function(err) {
            if (err) {
              console.error("Error: "+err);
              callback(err);
            } else
              callback(null);
          }
          );
        } else { 
          reportFWUpdateThroughTwin(twin, 
          {
            status: 'applyComplete',
            lastFirmwareUpdate: new Date().toISOString()
          }, 
          function(err) {
            if (err) {
              console.error("Error: "+err);
              callback(err);
            } else
              callback(null);
          });    
          
        }
      });
    }
  });
    
}

// The handler for the firmwareUpdate method.  This initiates
// the multi-phase firmware update sequence.
function onFirmwareUpdate(request, response) {
  
  // Get the firmware image Uri from the body of the method request
  var fwPackageUri = request.payload.fwPackageUri;

  var result = url.parse(fwPackageUri);
  
  if (result.protocol != 'https:') {
    // Respond the cloud app.  Error 400 Bad Format.
    response.send(400, 'Invalid URL format.  Must use https:// protocol.', function(err) {
      if (!!err) {
        console.error('An error occured when sending a method response:\n' + err.toString());
      } else {
        console.error('Response to method \'' + request.methodName + '\' sent successfully.');
      }
    });
      
  } else {


    // Respond the cloud app for the device method
    response.send(200, 'Firmware update started.', function(err) {
      if (!err) {
        console.error('An error occured when sending a method response:\n' + err.toString());
      } else {
        console.log('Response to method \'' + request.methodName + '\' sent successfully.');
      }
    });

    initiateFirmwareUpdateFlow(fwPackageUri, function(err){
      if (err) {
        console.error("Error in firmwareUpdate flow: "+err);
      } else {
        console.log("Completed firmwareUpdate flow");
      }
    });
  }
  
}

// Call the entry point for the device
main();
