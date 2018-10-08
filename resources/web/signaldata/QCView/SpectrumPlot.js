/*
 * Copyright (c) 2016 LabKey Corporation
 *
 * Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
 */
Ext4.define('LABKEY.SignalData.SpectrumPlot', {

    extend: 'Ext.Component',

    alias: 'widget.spectrum',

    colors: ['#00FE00', '#0100FE', '#FC01FC', '#FF0000', "#FF7F0E", "00EFEF", "CBCB00"],

    yLabel: '',

    xLabel: '',

    leftRight: [0, 30],

    lowHigh: [0, 1200],

    id: Ext4.id(),

    height: '100%',

    autoEl: {
        tag: 'div'
    },

    autoZoom: false,

    highlight: undefined,

    constructor : function(config) {
        this.callParent([config]);
        this.addEvents('zoom');
    },

    clearPlot : function() {
        Ext4.get(this.id).update('');
    },

    renderPlot : function(contents) {

        if (!contents) {
            if (!this._lastContent) {
                console.error(this.$className + '.renderPlot requires contents be provided at least once');
                return;
            }
            contents = this._lastContent;
        }

        // var layers = [];
        var colors = this.colors;

        var xleft = this.leftRight[0], xright = this.leftRight[1],
              low = this.lowHigh[0],     high = this.lowHigh[1];

        var c=0, isHighlight = false, useHighlight = (this.highlight ? true : false), color;

        var data = [];
        var annotations = [];

        for (var i=0; i < contents.length; i++) {
            //
            // create point layer
            //
            color = colors[c%colors.length];

            if (useHighlight) {
                isHighlight = (this.highlight === contents[i].fileName);

                if (!isHighlight) {
                    color = 'rgba(160, 156, 156, 0.3)'//'#A09C9C';
                }
            }
            c++;

            d = SignalDataService.getData(contents[i], 0, 0);

            var line = {x: d.map(val => val[0]),
                        y: d.map(val => val[1]),
                        mode: 'lines',
                        type: 'scatter',
                        name: contents[i].fileName,
                        line: {color: color},
             };
            data.push(line);

            // obtain peak annotations
            if(contents[i].peakinfo != null) {
                for (var j = 0; j < contents[i].peakinfo.length; j++) {
                    var x = contents[i].peakinfo[j].x;
                    var y = contents[i].peakinfo[j].y;
                    var annotation = {
                        name: contents[i].fileName + x + ',' + y,
                        x: parseFloat(x),
                        y: parseFloat(y),
                        xref: 'x',
                        yref: 'y',
                        text: '<a href="#' +
                            'peaktable" target="_self" style="color:white">' +
                            // contents[i].fileName  + x + ',' + y +
                            // '" target="_self" style="color:white">' +
                            x + ' ' + y +
                            '</a>',
                        showarrow: true,
                        arrowhead: 2,
                        arrowsize: 1,
                        arrowwidth: 2,
                        ax: 40,
                        ay: -40,
                        borderwidth: 2,
                        borderpad: 4,
                        bgcolor: color,
                        opacity: 0.8,
                        font: {
                            color: "#ffffff",
                            size: 12
                        },
                        captureevents: true,
                    };
                    annotations.push(annotation);
                }
            }
        }

        this.update('');

        var box = this.getBox();

        var width = box.width;
        var height = box.height - 30;

        var layout = {
            showlegend: true,
            xaxis: {range: [xleft, xright]},
            yaxis: {range: [low, high]},
            annotations:
                annotations,
            width: width,
            height: height,
            editable: true,
            responsive: true
        };

        this._lastContent = contents;

        var clearRowHighlight = function(currentValue) {
            currentValue.childNodes.forEach(function (c)
            {
                c.setAttribute('style', '');
                c.setAttribute('tabindex', '');
            });
        };
        var setRowHighlight = function(currentValue) {
            currentValue.childNodes.forEach(function(c)
            {
                c.setAttribute('style', 'background-color:#FFFF00');
                c.setAttribute('tabindex', '-1');
            });
        }
        // render plot with disabled legend clicking and highlight clicked annotations in data table
        Plotly.newPlot(this.id, data, layout).then(gd => {
            // clear previous highlight if clicking elsewhere on the plot
            gd.on('plotly_click', (event, data) => {
                Ext4.getCmp('peaktable').el.dom.getElementsByTagName('tbody')[0].childNodes.forEach(clearRowHighlight);
            });
            //apply highlight
            gd.on('plotly_clickannotation', (event, data) => {
                Ext4.getCmp('peaktable').el.dom.getElementsByTagName('tbody')[0].childNodes.forEach(clearRowHighlight);
                setRowHighlight(document.querySelector('tr[id$="'+ event.annotation.name + '"]'));
            });
            gd.on('plotly_legendclick', () => false);
        });
    },


    setHighlight : function(highlight) {
        this.highlight = highlight;
    },

    resetZoom : function() {
        this.leftRight = [0, 30];
        this.lowHigh = [0, 1200];
        if (this._lastContent) {
            this.renderPlot();
        }
    },

    updateZoom : function(left, right, bottom, top) {
        if (this.autoZoom) {
            this.leftRight = [left, right];
            this.lowHigh = [bottom, top];
            this.renderPlot();
        }
        this.fireEvent('zoom', left, right, bottom, top);
    }
});