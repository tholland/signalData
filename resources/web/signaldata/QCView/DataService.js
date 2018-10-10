/*
 * Copyright (c) 2016-2017 LabKey Corporation
 *
 * Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
 */
/**
 * Created by Nick Arnold on 9/26/2014.
 */
Ext4.define('LABKEY.SignalData.DataService', {

    alternateClassName: ['SignalDataService'],

    singleton: true,

    _ContentCache: {},
    _PipelineCache: undefined,
    _AssayTypeCache: {},

    FileContentCache : function(provisionalRun, name, callback, scope) {
        var expData = provisionalRun.get('expDataRun');

        var index = provisionalRun.get('index');
        var path = expData['pipelinePath']+index;

        var content = this._ContentCache[path];

        if (content)  {
            if (Ext4.isFunction(callback)) {
                callback.call(scope || this, content);
            }
        }
        else {
            this._ContentCache = {};
            var webdav = Ext4.create('File.system.Webdav', {});
            var url = webdav.prefixUrl +
                LABKEY.ActionURL.getContainer() +
                '/@files/' +
                expData['pipelinePath'];

            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);

            // If specified, responseType must be empty string or "text"
            xhr.responseType = 'text';

            xhr.onload = function () {
                try {
                    if (xhr.readyState === xhr.DONE && xhr.status === 200) {
                        var content = JSON.parse(xhr.responseText);
                        content.fileName = name;
                        content.series = content.series.slice(index, index + 1);
                        var selectedPeaks = [];
                        for (var i = 0; i < content.peakinfo.length; i++) {
                            if (content.peakinfo[i].index == index) {
                                selectedPeaks.push(content.peakinfo[i]);
                            }
                        }
                        content.peakinfo = selectedPeaks;
                        SignalDataService._ContentCache[path] = content;

                        if (Ext4.isFunction(callback))
                            callback.call(scope || this, content);
                    }
                    else {
                        throw "";
                    }
                // json loading failed so try to load as a zip
                } catch (e) {
                    try {
                        var oReq = new XMLHttpRequest();
                        oReq.open("GET", url, true);
                        oReq.responseType = "blob";

                        oReq.onload = function (oEvent) {
                            var blob = oReq.response;

                            var new_zip = new JSZip();
                            new_zip.loadAsync(blob).then(function () {
                                // read in the first file in the zip file
                                Object.values(new_zip.files)[0].async("string").then(
                                    function (c) {
                                        var content = JSON.parse(c);
                                        content.fileName = name;
                                        content.series = content.series.slice(index, index + 1);
                                        var selectedPeaks = [];
                                        for (var i = 0; i < content.peakinfo.length; i++) {
                                            if (content.peakinfo[i].index == index) {
                                                selectedPeaks.push(content.peakinfo[i]);
                                            }
                                        }
                                        content.peakinfo = selectedPeaks;
                                        SignalDataService._ContentCache[path] = content;

                                        if (Ext4.isFunction(callback))
                                            callback.call(scope || this, content);
                                    }
                                );
                            });;
                        };
                        oReq.send(null);
                    } catch (e) {
                        alert('Failed to Load File Contents');
                        if (Ext4.isFunction(callback))
                            callback.call(scope || this, content);
                    }
                }
            };

            xhr.send(null);
        }
    },

    /**
     * Retrieves the data from a file response object
     * @param datacontent
     * @param xleft
     * @param xright
     * @param mod - if not specified it will not be used
     * @param index - series index to use
     * @returns {Array}
     */
    getData : function(datacontent, xleft, xright, mod) {
        var data = [];
        if (datacontent) {
            var _data = datacontent.series[0].data;
            _data.shift(); // get rid of column headers
            var newData = [], d, xy;

            //
            // check modulus
            //
            if (!mod || !Ext4.isNumber(mod)) {

                //
                // check for bounds
                //
                if (xleft == 0 && xright == 0) {
                    for (d=0; d < _data.length; d++) {
                        xy = _data[d];
                        xy[0] = parseFloat(xy[0]);
                        xy[1] = parseFloat(xy[1]);
                        newData.push(xy);
                    }
                }
                else {
                    //
                    // using bounds
                    //
                    for (d=0; d < _data.length; d++) {
                        xy = _data[d];
                        xy[0] = parseFloat(xy[0]);
                        xy[1] = parseFloat(xy[1]);
                        if (xy[0] > xleft && xy[0] < xright)
                            newData.push(xy);
                    }
                }
            }
            else {
                //
                // check for bounds
                //
                if (xleft == 0 && xright == 0) {
                    for (d=0; d < _data.length; d++) {
                        if (d%mod == 0) {
                            xy = _data[d];
                            xy[0] = parseFloat(xy[0]);
                            xy[1] = parseFloat(xy[1]);
                            newData.push(xy);
                        }
                    }
                }
                else {
                    //
                    // using bounds
                    //
                    for (d=0; d < _data.length; d++) {
                        if (d%mod == 0) {
                            xy = _data[d];
                            xy[0] = parseFloat(xy[0]);
                            xy[1] = parseFloat(xy[1]);
                            if (xy[0] > xleft && xy[0] < xright)
                                newData.push(xy);
                        }
                    }
                }
            }

            data = newData;
        }
        return data;
    },

    /**
     * Get the max y value * 110%
     * @param datacontents
     * @returns {Number} max y value * 110% rounded to the nearest 10
     */
    getMaxHeight : function(datacontents) {
        var maxY = 0;
        for (var i = 0; i < datacontents.length; i++)
        {
            var datacontent = datacontents[i];
            if (datacontent && datacontent.series)
            {
                var _data = datacontent.series[0].data;
                _data.shift(); // get rid of column headers
                var d, xy, y;

                for (d = 0; d < _data.length; d++) {
                    xy = _data[d];
                    y = parseFloat(xy[1]);
                    if (y > maxY) {
                        maxY = y;
                    }
                }
            }
        }
        return maxY > 0 ? Math.ceil(maxY * 1.1/10)*10 : 1200;
    },

    /**
     * Use this to retrieve all the required information with regards to the given Signal Data assay runIds
     * @param schema
     * @param runIds
     * @param dataNames
     * @param callback
     * @param scope
     */
    getRun : function(schema, runIds, dataNames, callback, scope) {

        var context = {
            RunIds: runIds,
            DataNames: dataNames
        }, _count = 0;

        var loader = function() {
            _count++;
            if (_count == 4) {

                var batchIds = [];
                for (var i = 0; i < context.RunDefinitions.length; i++) {
                    batchIds.push(context.RunDefinitions[i].Batch.value);
                }

                LABKEY.Experiment.loadBatches({
                    assayId: context.AssayDefinition.id,
                    batchIds: batchIds,
                    success: function(RunGroups) {
                        //context.batch = RunGroup;

                        //
                        // Transform select rows result into a structure the Ext store can accept
                        //
                        var names = {};
                        var runData = {};
                        var d = [];
                        var yAxes = [];

                        for (var j = 0; j < RunGroups.length; j++) {
                            var RunGroup = RunGroups[j];
                            var runs = RunGroup.runs;
                            var filteredRuns = [];

                            //
                            // Find the associated runs
                            //
                            for (var r=0; r < runs.length; r++) {
                                for (var ind = 0; ind < context.RunIds.length; ind++){
                                    if (context.RunIds[ind] == runs[r].id) {
                                        filteredRuns.push(runs[r]);
                                        break;
                                    }
                                }
                            }

                            var dataNames = {};
                            if(context.DataNames)
                                context.DataNames.forEach(function(name){
                                    dataNames[name] = true;
                                });


                            for (var k = 0; k < filteredRuns.length; k++)
                            {
                                var run = filteredRuns[k];
                                var runIdentifier = run.name;

                                //If DataNames is null, all files should be used.
                                if (context.DataNames == null) {
                                    continue;
                                }

                                var name = run.properties['RunIdentifier'];
                                var filePath = "";
                                var dataFile = run.properties['DataFile']['dataFileURL'];

                                var osDelimiter = '/';
                                var fileName = dataFile.split(osDelimiter).pop();  //Hack to make fileLink and pipe resolve file
                                if (fileName == dataFile) { //Filename wasn't parsed correctly
                                    //Check if windows delimiter
                                    osDelimiter = '\\';
                                    fileName = dataFile.split(osDelimiter).pop();
                                }
                                filePath = context.pipe + osDelimiter + runIdentifier + osDelimiter + fileName;

                                names[dataFile] = name;
                                runData[dataFile] = run.properties['DataFile'];

                                yAxes.push(RunGroup.properties['YAxis']);
                            }
                        }

                        var expected = Object.keys(names).length;
                        var received = 0;

                        var done = function() {
                            received++;
                            if (received == expected) {
                                context.rawInputs = d;
                                context.yAxes = yAxes;

                                if (Ext4.isFunction(callback)) {
                                    callback.call(scope || this, context);
                                }
                            }
                        };

                        var getDataContent = function(names, runData, i, d, callback) {
                            var key = Object.keys(names)[i];

                            var data = runData[key];

                            var webdav = Ext4.create('File.system.Webdav', {});
                            var url = webdav.prefixUrl +
                                      LABKEY.ActionURL.getContainer() +
                                      '/@files/' +
                                      data.pipelinePath;

                            var xhr = new XMLHttpRequest();
                            xhr.open('GET', url, true);

                            // If specified, responseType must be empty string or "text"
                            xhr.responseType = 'text';

                            xhr.onload = function () {
                                try {
                                    if (xhr.readyState === xhr.DONE && xhr.status === 200) {
                                        var c = JSON.parse(xhr.responseText);
                                        if (c.series) {
                                            for (var i = 0; i < c.series.length; i++) {
                                                d.push({
                                                    name: names[key] + ":" + c.series[i].name,
                                                    expDataRun: data,
                                                    index: i
                                                });
                                            }
                                        }
                                        if (Ext4.isFunction(callback))
                                            callback.call(this, c);
                                    }
                                    else {
                                        throw "";
                                    }
                                // json loading failed, try reading it as a zip
                                } catch (e) {
                                    try {
                                        var oReq = new XMLHttpRequest();
                                        oReq.open("GET", url, true);
                                        oReq.responseType = "blob";

                                        oReq.onload = function (oEvent) {
                                            var blob = oReq.response;

                                            var new_zip = new JSZip();
                                            new_zip.loadAsync(blob).then(function () {
                                                // read in the first file in the zip file
                                                Object.values(new_zip.files)[0].async("string").then(
                                                    function (c) {
                                                        c = JSON.parse(c);
                                                        if (c.series) {
                                                            for (var i = 0; i < c.series.length; i++) {
                                                                d.push({
                                                                    name: names[key] + ":" + c.series[i].name,
                                                                    expDataRun: data,
                                                                    index: i
                                                                });
                                                            }
                                                        }
                                                        if (Ext4.isFunction(callback))
                                                            callback.call(this, c);
                                                    }
                                                );
                                            });
                                        };
                                        oReq.send(null);
                                    } catch (e) {
                                        alert("Failed to Load File Contents");
                                        if (Ext4.isFunction(callback))
                                            callback.call(this);
                                    }
                                }
                            };

                            xhr.send(null);
                        };

                        for(var i=0; i<expected; i++) {
                            getDataContent(names, runData, i, d, done);
                        }
                    },
                    scope: this
                });
            }
        };

        //
        // Get the associated SignalData configuration
        //
        this.getPipelineConfiguration(function(data) {
            context.pipe = data.webDavURL; loader();
        }, this);

        //
        // Get the associated Assay information
        //
        this.getAssayDefinition('Signal Data', function(def) {
            context.AssayDefinition = def; loader();
        }, this);

        //
        // Get the associated HPLC Assay information
        //
        this.getAssayDefinition('HPLC', function(def) {
            context.HPLCDefinition = def; loader();
        }, this);

        //
        // Get the associated Batch information
        //
        this.getBatchDefinition(schema, context.RunIds, function(def) {
            context.RunDefinitions = def; loader();
        }, this);
    },

    getPipelineConfiguration : function(callback, scope) {
        if (Ext4.isObject(this._PipelineCache)) {
            if (Ext4.isFunction(callback)) {
                callback.call(scope || this, Ext4.clone(this._PipelineCache));
            }
        }
        else {
            Ext4.Ajax.request({
                url: LABKEY.ActionURL.buildURL('SignalData', 'getSignalDataPipelineContainer.api'),
                success: function(response) {
                    this._PipelineCache = Ext4.decode(response.responseText);
                    if (Ext4.isFunction(callback)) {
                        callback.call(scope || this, Ext4.clone(this._PipelineCache));
                    }
                },
                scope: this
            });
        }
    },

    getAssayDefinition : function(assayType /* String */, callback, scope) {
        //TODO: can we do this by ID?
        if (Ext4.isString(assayType)) {
            if (Ext4.isObject(this._AssayTypeCache[assayType])) {
                if (Ext4.isFunction(callback)) {
                    callback.call(scope || this, this._AssayTypeCache[assayType]);
                }
            }
            else {
                LABKEY.Assay.getByType({
                    type: assayType,
                    success: function(defs) {
                        this._AssayTypeCache[assayType] = defs[0];
                        if (Ext4.isFunction(callback)) {
                            callback.call(scope || this, this._AssayTypeCache[assayType]);
                        }
                    },
                    scope: this
                });
            }
        }
    },

    getBatchDefinition : function(assaySchema /* String */, runIds /* Number */, callback, scope) {
        LABKEY.Query.selectRows({
            schemaName: assaySchema,
            queryName: 'Runs',
            requiredVersion: 13.2,
            filterArray: [ LABKEY.Filter.create('RowId', runIds.join(';'), LABKEY.Filter.Types.IN) ],
            success: function(data) {
                if (Ext4.isFunction(callback)) {
                    callback.call(scope || this, data.rows); // LABKEY.Query.Row
                }
            },
            scope: this
        });
    },
});
