# Azure Relay Hybrid Connector Add-on for Splunk

This add-on is built using Node.js and has been tested on Ubuntu 14.04 and Windows 10.

It communicates with an Azure Function via an Azure Relay Hybrid Connection. Each message received is an event that is then indexed in Splunk.  

The Azure Function is documented [here](https://github.com/sebastus/AzureFunctionForSplunk).

The configuration settings for this add-on are:
* AzureRelayNamespace
* AzureRelayPath
* SASKeyRuleName
* SASKeyValue

These values are described in steps 1 and 2 of this [page](https://docs.microsoft.com/en-us/azure/service-bus-relay/relay-hybrid-connections-dotnet-get-started).

# Support

If you have encountered difficulties with the add-on, the first thing to do is ensure that all Node.js dependencies are installed correctly.  

If that doesn't help, the next thing to do is switch logging for ExecProcessor to Debug (Settings / Server Settings / Server Logging in Splunk Web) and recycle the add-on (disable/enable). Then search for 'azure_relay_hc' ERROR and DEBUG messages. There will be a lot of DEBUG messages. If you don't see anything helpful, open an issue in the repo.  
