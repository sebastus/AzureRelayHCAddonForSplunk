//
// AzureRelayHCAddonForSPlunk
//
// Copyright (c) Microsoft Corporation
//
// All rights reserved. 
// 
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy 
// of this software and associated documentation files (the ""Software""), to deal 
// in the Software without restriction, including without limitation the rights 
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
// copies of the Software, and to permit persons to whom the Software is furnished 
// to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all 
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS 
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR 
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER 
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// 

/* jshint unused: true */

(function () {
    var _ = require('underscore');
    var splunkjs = require("splunk-sdk");
    var ModularInputs = splunkjs.ModularInputs;
    var Logger = ModularInputs.Logger;
    var Event = ModularInputs.Event;
    var Scheme = ModularInputs.Scheme;
    var Argument = ModularInputs.Argument;
    var WebSocket = require('hyco-ws');
    var strings = require('./strings');
    strings.stringFormat();

    // other global variables here

    // getScheme method returns introspection scheme
    exports.getScheme = function () {

        var scheme = new Scheme("Azure Relay Hybrid Connector");

        // scheme properties
        scheme.description = "Receives various metrics and logs from Microsoft Azure via an Azure Relay Hybrid Connection.";
        scheme.useExternalValidation = true;  // if true, must define validateInput method
        scheme.useSingleInstance = false;      // if true, all instances of mod input passed to
        //   a single script instance; if false, user 
        //   can set the interval parameter under "more settings"

        // add arguments
        scheme.args = [
            new Argument({
                name: "AzureRelayNamespace",
                dataType: Argument.dataTypeString,
                description: "Azure Relay namespace, such as <namespace>.servicebus.windows.net.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "AzureRelayPath",
                dataType: Argument.dataTypeString,
                description: "Azure Relay path, such as sb://<namespace>.servicebus.windows.net/<path>.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "SASKeyRuleName",
                dataType: Argument.dataTypeString,
                description: "Name of the SAS key rule, such as RootManageSharedAccessKey.",
                requiredOnCreate: true,
                requiredOnEdit: false
            }),
            new Argument({
                name: "SASKeyValue",
                dataType: Argument.dataTypeString,
                description: "The SAS key contained in the preceding rule.",
                requiredOnCreate: true,
                requiredOnEdit: false
            })
            // other arguments here
        ];

        return scheme;
    };

    // validateInput method validates the script's configuration (optional)
    exports.validateInput = function (definition, done) {
        done();
    };

    function uuid() {
        var x = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        return x;
    }

    // streamEvents streams the events to Splunk Enterprise
    exports.streamEvents = function (name, singleInput, eventWriter, done) {

        // modular input logic goes here        
        var loggerId = name + ' ' + uuid();

        Logger.debug(loggerId, 'Entered streamEvents');

        var quiescenceTimer;

        var ns = singleInput.AzureRelayNamespace + ".servicebus.windows.net";
        var path = singleInput.AzureRelayPath;
        var keyrule = singleInput.SASKeyRuleName;
        var key = singleInput.SASKeyValue;

        Logger.debug(loggerId, "Input parameters ns: " + ns);
        Logger.debug(loggerId, "Input parameters path: " + path);
        Logger.debug(loggerId, "Input parameters keyrule: " + keyrule);
        Logger.debug(loggerId, "Input parameters key: ********");

        function tickTock() {
            setTimeout(function () {
                Logger.debug(loggerId, "tick");
                tickTock();
            }, 1000);
        }

        function setMyTimer(preset) {
            var timeToWait = 5;
            var message = "Setting";
            if (preset) {
                timeToWait = 30;
                message = "Pre-setting";
            }
            var d = new Date();
            Logger.debug(loggerId, String.format('{0} quiescence timer to {1} seconds at: {2}',
                message, timeToWait, d.toISOString()));
            if (!_.isUndefined(quiescenceTimer)) {
                clearTimeout(quiescenceTimer);
            }
            quiescenceTimer = setTimeout(disconnectFunction, timeToWait * 1000);
        }

        var errorFound = false;
        var wss = WebSocket.createRelayedServer(
            {
                server: WebSocket.createRelayListenUri(ns, path),
                token: WebSocket.createRelayToken('http://' + ns, keyrule, key)
            },
            function (ws) {
                Logger.debug(loggerId, 'connection accepted');

                ws.onmessage = function (sbMessage) {
                    var sbMessageString = sbMessage.data.toString('utf8');
                    var sbMessageLength = sbMessageString.length;

                    if (sbMessageLength === 1) {
                        var bb = new Buffer(sbMessageString, "binary");
                        Logger.debug(loggerId, String.format('Byte code of short message is: {0}', bb[0]));
                        events = [];
                    } else {
                        try {
                            events = JSON.parse(sbMessageString);
                        } catch (e) {
                            Logger.error(loggerId, 'error parsing json: ' + e);
                        }
                    }

                    var countOfEvents = events.length;
                    Logger.debug(loggerId, String.format("there are {0} events in the array", countOfEvents));

                    var eventsIndexed = 0;
                    for (index = 0; index < countOfEvents; index++) {
                        // Logger.debug(loggerId, String.format("Event {0} is: {1}", index, JSON.stringify(events[index])));

                        clearMessageInstance = events[index];
                        var curEvent = new Event({
                            stanza: name,
                            sourcetype: clearMessageInstance.sourceType,
                            data: clearMessageInstance.event
                        });
                        try {
                            eventWriter.writeEvent(curEvent);
                            eventsIndexed++;
                            //Logger.debug(loggerId, String.format('streamEvents.messageHandler wrote an event'));
                        }
                        catch (e) {
                            errorFound = true; // Make sure we stop streaming if there's an error at any point
                            Logger.error(loggerId, e.message);

                            // ensure no timer on the node queue
                            if (!_.isUndefined(quiescenceTimer)) {
                                clearTimeout(quiescenceTimer);
                            }

                            // tell splunk we're done.
                            done(e);

                            // we had an error; die
                            return;
                        }

                    }
                    Logger.debug(loggerId, String.format('streamEvents.messageHandler wrote {0} events.', eventsIndexed));

                    setMyTimer(false);
                };
                ws.on('close', function () {
                    Logger.debug(loggerId, 'connection closed');
                });
            });

        function disconnectFunction() {
            // streaming is done
            var d = new Date();
            Logger.debug(loggerId, String.format('disconnect function called at: {0}', d.toISOString()));
            wss.close(function () {
                d = new Date();
                Logger.debug(loggerId, String.format('websocket closed and add-on terminated at: {0}', d.toISOString()));
                done();
            });
        }

        setMyTimer(true);
        Logger.debug(loggerId, "Listening");

        //tickTock();

        wss.on('error', function (err) {
            Logger.error(loggerId, 'WSS error: ' + err);

            // tell splunk we're done.
            done(err);

            // we had an error; die
            return;

        });

    };

    ModularInputs.execute(exports, module);
})();