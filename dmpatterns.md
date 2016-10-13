This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

# Running DM Patterns Samples

From the root directory of the repo, run through the following steps to see the device and service interacting to enable the DM patterns:

### Reboot DM Pattern:

1. Start the device side first, as it will register the C2D method listener for reboot:
    ```
    node \node\device\samples\dmpatterns_reboot_device.js <IotHub device connection string>
    ```

2. In a new terminal window, start the service side to initate the reboot:

    ```
    node \node\service\samples\dmpatterns_reboot_service.js <IotHub connection string>
    ```


### Firmware Update DM Pattern:

1. Start the device side first, as it will register the C2D method listener for firmware update:

    ```
    node \node\device\samples\dmpatterns_fwupdate_device.js <IotHub device connection string>
    ```

2. In a new terminal window, start the service side to initate the firmware update:

    ```
    node \node\service\samples\dmpatterns_fwupdate_service.js <IotHub connection string>
    ```

