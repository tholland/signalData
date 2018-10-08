/*
 * Copyright (c) 2016 LabKey Corporation
 *
 * Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
 */
/**
 * Created by iansigmon on 8/8/16.
 */
Ext4.ns('LABKEY.SignalData');

LABKEY.SignalData.initializeUploadForm = function(metadataFormElId, metadataJsonId, nextButtonElId, renderToId) {

    var assayType = 'Signal Data';
    var assay;
    var run;
    var runFolder;

    var loadAssay = function(cb, scope) {
        if (LABKEY.page && LABKEY.page.assay) {
            assay = LABKEY.page.assay;
            cb.call(scope || this);
        }
        else {
            //TODO: may need to rework this for webpart...
            LABKEY.Assay.getById({
                id: LABKEY.ActionURL.getParameter("rowId"),
                success: function(definitions) {
                    if (definitions.length == 0) {
                        var link = LABKEY.Utils.textLink({
                            text: 'New assay design',
                            href: LABKEY.ActionURL.buildURL('assay', 'chooseAssayType')
                        });
                        Ext4.get(renderToId).update('To get started, create a "' + assayType + '" assay. ' + link);
                    }
                    else if (definitions.length == 1) {
                        assay = definitions[0];
                        cb.call(scope || this);
                    }
                    else {
                        // In the future could present a dropdown allowing the user to switch between active assay design
                        Ext4.get(renderToId).update('This webpart does not currently support multiple "' + assayType + '" assays in the same folder.');
                    }
                }
            });
        }
    };

    var getRunFolderName = function() {
        if(runFolder == null) {
            var now = new Date();
            var parts = [now.getFullYear(), now.getMonth() + 1, //javascript uses 0 based month
                now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()];
            runFolder = parts.join('_');
        }
        return runFolder;
    };

    var saveRun = function(run) {

        LABKEY.Experiment.saveBatch({
            assayId: assay.id,
            batch: {
                batchProtocolId: assay.id,
                runs: [{
                    name: run.name,
                    properties: run.properties,
                    dataRows: run.dataRows,
                    dataInputs: run.dataInputs
                }]
            },
            success: function() {
                window.location = LABKEY.ActionURL.buildURL('assay', 'assayBegin', null, {rowId: assay.id}) || this;
            },
            failure: function(response){
                Ext4.Msg.alert("Saving run failed!");
            }
        }, this);
    }

    //Check if folder exists and if not then create it
    var checkOrCreateFolder = function (targetFolder, fileSystem, scope, callback, data, context) {
        var targetURL = fileSystem.concatPaths(fileSystem.getAbsoluteBaseURL(), targetFolder);
        LABKEY.Ajax.request({
            url: targetURL,
            method: 'GET',
            params: {method: 'JSON'},
            success: function (response) {
                callback.call(scope, data, context);
            },
            failure: function (b, xhr) {
                //Working directory not found, create it.
                fileSystem.createDirectory({
                    path: targetURL,
                    success: function () {
                        callback.call(scope, data, context);
                    },
                    failure: function () {
                        Ext4.Msg.alert("Error", "Couldn't generate working directory");
                    },
                    scope: scope
                }, scope);
            },
            scope: this
        }, this);

    };

    var processJson = function(data, context) {
        var contentStr = "";
        for(var i=0;i<data.content.sheets[0].data.length;i++){
            contentStr += data.content.sheets[0].data[i][0].value+"\n";
        }

        var jsonObj = Ext.util.JSON.decode(contentStr);

        var fileSystem = Ext4.create('File.system.Webdav', {});

        fileSystem.movePath({
            source: decodeURI(LABKEY.ActionURL.getContainer() + '/@files/assaydata/' + data.dataFileURL.replace(/.*\//, '')),
            destination: LABKEY.ActionURL.getContainer() + '/@files/SignalDataAssayData/' + getRunFolderName() + '/' + data.name,
            isFile: true
        });

        run = new LABKEY.Exp.Run();
        run.name = getRunFolderName();

        for (var i=0;i<assay.domains[assay.name + ' Run Fields'].length;i++) {
            var index = assay.domains[assay.name + ' Run Fields'][i].name;
            run.properties[index] = jsonObj[index];
        }
        run.dataInputs = [ data ];

        var newPipelinePath = 'SignalDataAssayData/' + getRunFolderName() + '/' + data.name;
        data.dataFileURL = encodeURI(data.dataFileURL.replace(encodeURI(data.pipelinePath), newPipelinePath));
        data.pipelinePath = newPipelinePath;
        data.properties['Datafile'] = data.dataFileURL;

        if (jsonObj.peakinfo != null) {
            for (var i = 0; i < jsonObj.peakinfo.length; i++) {
                var row = {};
                row['Name'] = jsonObj.series[jsonObj.peakinfo[i]['index']].name;
                for (var key in jsonObj.peakinfo[i]) {
                    row[key] = jsonObj.peakinfo[i][key];
                }
                run.dataRows.push(row);
            }
        }
        run.properties['DataFile'] = decodeURI(data.dataFileURL).replace('file:','');

        saveRun(run);
    };

    var jsonSubmitted = function (data, context) {
        if (!data.content)
        {
            LABKEY.Ajax.request({
                url: LABKEY.ActionURL.buildURL('SignalData', 'getSignalDataPipelineContainer.api'),
                method: 'GET',
                success: function (response) {
                    var context = Ext4.decode(response.responseText);
                    if (Ext4.isObject(context) && !Ext4.isEmpty(context.containerPath) && !Ext4.isEmpty(context.webDavURL)) {
                        data.getContent({
                            format: 'jsonTSVExtended',
                            success: function (content) {
                                data.content = content;

                                this.fileSystem = Ext4.create('File.system.Webdav', {
                                    rootPath: context['webDavURL'],
                                    rootName: 'fileset'
                                });

                                var folderName = getRunFolderName();
                                checkOrCreateFolder(folderName, this.fileSystem, this, processJson, data, context );
                            },
                            failure: function (error, format) {
                                Ext4.Msg.alert("File processing failed!");
                            }
                        });
                    }
                    else {
                        Ext4.Msg.alert('Error', 'Failed to load the pipeline context for Signal Data');
                    }
                },
                failure: function (error, response) {
                    Ext4.Msg.alert('Error', 'Failed to load the pipeline context for Signal Data');
                }
            });
        }
    };

    var formFailed = function (form, action) {
        Ext4.Msg.alert('Upload failed!');
    };

    var jsonForm;
    loadAssay(function() {
        jsonForm = Ext4.create('Ext.form.Panel',{
            renderTo: metadataJsonId,
            border: false,
            bodyStyle: 'background-color: transparent;',
            fileUpload: true,
            url: LABKEY.ActionURL.buildURL("assay", "assayFileUpload", LABKEY.ActionURL.getContainer(), { protocolId: assay.id }),
            flex:1,
            items: [{
                xtype: 'filefield',
                id: 'json',
                width: 400,
                buttonConfig: {
                    text: 'Select input file'
                }
            },
                {
                    xtype: 'hidden',
                    name: 'X-LABKEY-CSRF',
                    value: LABKEY.CSRF
                }],
            method: "POST",
            listeners: {
                actioncomplete : function (form, action) {
                    action.result.dataFileURL;
                    var data = new LABKEY.Exp.Data(action.result);
                    jsonSubmitted(data);
                },
                actionfailed: formFailed
            },
        });

        Ext4.create('Ext.button.Button', {
            xtype: 'button',
            renderTo: nextButtonElId,
            text: 'submit',
            handler: function () {
                jsonForm.submit();
            }
        });
    });
};
