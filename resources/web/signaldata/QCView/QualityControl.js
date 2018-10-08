/*
 * Copyright (c) 2016 LabKey Corporation
 *
 * Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
 */
Ext4.define('LABKEY.SignalData.QualityControl', {
    extend: 'Ext.panel.Panel',

    layout: {
        type: 'card',
        align: 'stretch',
        pack: 'start',
    },

    minWidth: 650,

    height: 1500,

    initComponent: function () {

        this.items = [];

        this.callParent();

        this.getRunContext(function (context) {
            this.loadContext(context);
        }, this);
    },

    loadContext: function (context) {
        this.context = context;
        this.add(this.getSampleCreator());
    },

    getSampleCreator: function () {
        if (!this.sampleCreator) {
            this.sampleCreator = Ext4.create('LABKEY.SignalData.SampleCreator', {
                context: this.context,
                scope: this
            });
        }
        return this.sampleCreator;
    },

    getRunContext: function (callback, scope) {
        LABKEY.DataRegion.getSelected({
            selectionKey: LABKEY.ActionURL.getParameter('selectionKey'),
            success: function (resultSelection) {
                LABKEY.Query.selectRows({
                    schemaName: LABKEY.ActionURL.getParameter('schemaName'),
                    queryName: 'Runs',
                    requiredVersion: 13.2,
                    filterArray: [
                        LABKEY.Filter.create('RowId', resultSelection.selected.join(';'), LABKEY.Filter.Types.IN)
                    ],
                    success: function (runs) {
                        if (runs.rows.length > 0) {
                            var runIds = [];
                            var runNames = [];

                            Ext.each(runs.rows, function (row) {
                                runIds.push(row['RowId'].value);
                                runNames.push(row['RunIdentifier'].value);
                            });


                            LABKEY.Query.selectRows({
                                schemaName: LABKEY.ActionURL.getParameter('schemaName'),
                                queryName: 'Data',
                                requiredVersion: 13.2,
                                filterArray: [
                                    LABKEY.Filter.create('Run/RunIdentifier', runNames.join(';'), LABKEY.Filter.Types.IN)
                                ],
                                success: function (data) {
                                    var dataNames = [];

                                    Ext.each(data.rows, function(row) {
                                        dataNames.push(row['Name'].value);
                                    });

                                    SignalDataService.getRun(LABKEY.ActionURL.getParameter('schemaName'), runIds, dataNames, callback, scope);
                                }
                            });
                        }
                    }
                });
            }
        });
    }
});