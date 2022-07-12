import { Looker, VisualizationDefinition } from '../common/types';

import { handleErrors } from '../common/utils';
import * as d3 from 'd3'
import { deepStrictEqual, strict as assert } from 'assert';



declare var looker: Looker;



interface BarGraph extends VisualizationDefinition {

    elementRef?: HTMLDivElement,

}



const vis: BarGraph = {

    id: 'something', // id/label not required, but nice for testing and keeping manifests in sync

    label: 'Something',

    options: {

        errorBars: {

            type: 'string',

            label: 'Error Bars',

            values: [
                {"Standard Deviation": 'std'}, 
                {"95% Confidence Interval": '95CI'},
                {"90% Confidence Interval": '90CI'},
                {"99% Confidence Interval": '99CI'}
            ],

            display: 'radio',

            default: '95CI'

        },
        // orientation: {

        //     type: 'string',

        //     label: 'Orientation',

        //     values: [
        //         {"Horizontal": 'horizontal'}, 
        //         {"Vertical": 'vertical'}
        //     ],

        //     display: 'radio',

        //     default: 'horizontal'

        // },
        userSetMin: {

            type: 'number',
            label: 'Axis Minimum',
            display: 'number',
        },
        userSetMax: {

            type: 'number',
            label: 'Axis Maximum',
            display: 'number',
        }, 
        zeroline: {
            type: 'boolean',
            label: "Add Line at Zero",
            default: false
        },
        groupColors: {
            type: 'array',
            label: 'Group Colors',
            display: 'colors'
        },
        tickSize: {
            type: 'number',
            label: 'Tick Size',
            display: 'number',
            default: 10
        }

    },

    // Set up the initial state of the visualization

    create(element, config) {

        this.elementRef = element;

    },

    // Render in response to the data or settings changing

    update(data, element, config, queryResponse) {

        console.log( 'data (whole array)', data);

        console.log( 'element', element );

        console.log( 'config', config );

        console.log( 'queryResponse', queryResponse );

        const errors = handleErrors(this, queryResponse, {

            // min_pivots: 0,

            // max_pivots: 0,

            // min_dimensions: 1,

            // max_dimensions: 1,

            // min_measures: 1,

            // max_measures: 1

        });

        if (errors) { // errors === true means no errors
            const colors = config.groupColors ?? ['#015836', '#33658A', '#86BBD8', '#779B59', '#A7C957', '#F8BD4F', '#C76228','#8C4843', '#9E643C', '#AF929D']
            const allFields = queryResponse.fields.dimensions.map((dim)=> dim.name)
            const allFieldsLabel = queryResponse.fields.dimensions.map((dim)=> dim.label_short)
            console.log("allFields", allFields) //gets names of each field
            const formattedData = new Map()
            for (const field of allFields){
                formattedData.set(field, data.map(elem => elem[field].value))
            }
            console.log("formattedData", formattedData) //map of data field name to array of data
            
            const width = element.clientWidth
            const height = element.clientHeight

            function getStandardDeviation (array) {
                const n = array.length
                const mean = array.reduce((a, b) => a + b) / n
                return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
              }
            

            // TODO: get rid of magic numbers   
            const quantitative: string = allFields[2] //should make this adjustable? in options assumes second column is categorical, third is quantitative
            const categorical: string = allFields[1]
            element.innerHTML = ``; //not sure why I need this but if I remove it then it doesn't work
            const numberData = formattedData.get(quantitative)
            const categoricalData = formattedData.get(categorical)
            const categoricalUnique = [...new Set(formattedData.get(categorical))]
            const averages = [];
            let colorIndex = 0
            for (const catName of categoricalUnique){
                const color = colors[colorIndex]
                let catData = []
                for (let i=0; i<numberData.length; i++){
                    if (categoricalData[i] === catName){
                        catData.push(numberData[i])
                    }
                }
                let n = catData.length
                const mean = d3.mean(catData)  
                const std = getStandardDeviation(catData)
                let lowerBound:number;
                let upperBound:number;              
                switch(config.errorBars) {
                    case "95CI": {
                        lowerBound = mean - 1.96*std/Math.sqrt(n);
                        upperBound = mean + 1.96*std/Math.sqrt(n);
                        break;}
                    case "90CI": {
                        lowerBound = mean - 1.645*std/Math.sqrt(n);
                        upperBound = mean + 1.645*std/Math.sqrt(n);
                        break;}
                    case "99CI": {
                        lowerBound = mean - 2.576*std/Math.sqrt(n);
                        upperBound = mean + 2.576*std/Math.sqrt(n);
                        break;}
                    case "std": {
                        lowerBound = mean - std;
                        upperBound = mean + std;
                        break;}
                }
                averages.push({category:catName, average: mean, std:std, lowerBound: lowerBound, upperBound:upperBound, n:n, color:color})
                colorIndex = (colorIndex+ 1)%colors.length
            }
            console.log("averages", averages)
            console.log(categoricalUnique)
            console.log("numberData", numberData)

            //make svg and tooltip
            const svg = d3.select(element).append('svg').attr('width', width).attr('height', height)
            const tooltip = d3.select(element).append('div')
            .attr('id', 'tooltip')
            .attr('style', 'position: absolute; opacity: 0;')
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "1px")
            .style("border-radius", "5px")
            .style('font', '12px times')
            .style("padding", "10px")



            //if (config.orientation === 'horizontal'){
            //make axes labels
            const widthMargin = 30;
            const heightMargin = 55;//make this adjustable?

            let xlabel = svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "middle")
            .attr("x", width/2)
            .attr("y", height-6)
            .text(allFieldsLabel[1])
            .style("padding", "1px");

            svg.append("text")
            .attr("class", "y label")
            .attr("transform", "rotate(-90)")
            .attr("y", 0)
            .attr("x",-((height-heightMargin) / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text(allFieldsLabel[2])


            
            const g = svg.append('g')
            

            //auto-sets axisMin/Max based on range, adjusts for user input
            let axisMin = d3.min(numberData) - (d3.max(numberData) - d3.min(numberData))*0.1
            let axisMax = d3.max(numberData) + (d3.max(numberData) - d3.min(numberData))*0.1
            if (config.userSetMax !== undefined && config.userSetMax !== null) axisMax = config.userSetMax;
            if (config.userSetMin !== undefined && config.userSetMin !== null) axisMin = config.userSetMin;
            // Create scale
            const yscale = d3.scaleLinear()
            .domain([axisMin, axisMax])
            .range([height-heightMargin, 0]);

            // Add scales to axis
            let y_axis = d3.axisLeft()
                .scale(yscale);

            let xScale = d3.scaleBand().range ([0, width-widthMargin]).domain(categoricalUnique.map((c)=> c)).padding(0.4)
            let x_axis = d3.axisBottom().scale(xScale)
            
            //Append group and insert axis
            g.append("g")
            .attr("transform", "translate(50, 0)")
            .call(y_axis);

            g.append("g")
            .attr("transform", "translate(50, "+(height - heightMargin)+")")
            .call(x_axis)
            .selectAll(".tick text")
            .call(wrap, xScale.bandwidth()*1.6)
            .attr("font-size", config.tickSize ?? 10);

            svg.append("rect")
            .attr("x", xlabel.node().getBBox().x)
            .attr("y", xlabel.node().getBBox().y)
            .attr("width", xlabel.node().getBBox().width)
            .attr("height", xlabel.node().getBBox().width)
            .attr("fill", 'white')
            svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "middle")
            .attr("x", width/2)
            .attr("y", height-6)
            .text(allFieldsLabel[1])
            .style("padding", "1px");

            //create functions for hover tooltip
            const mouseover = (event, d) => {
                console.log('pagex', event.pageX)
                tooltip.style("opacity", 1);
                console.log("made it to here")
              };
        
              const mouseleave = (event, d) => {
                tooltip.style('opacity', 0);
              }
        
              const mousemove = (event, d) => {
                console.log("this is working")
                tooltip.html(`${d.category}`+ "<br/>"+`Num Measurements: ${d.n}`+ "<br/>" + `Mean: ${Math.round(d.average*100)/100}`);
                d3.select('#tooltip')
                .style('left', (event.pageX+10) + 'px')
                .style('top', (event.pageY+10) + 'px')
                }

            //make bar graphs
            g.selectAll(".bar")
            .data(averages)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", function(d) { return xScale(d.category)+50; })
            .attr("y", function(d) { return yscale(d.average); })
            .attr("width", xScale.bandwidth())
            .attr("height", function(d) { return height - heightMargin - yscale(d.average); })
            .attr("fill", function(d) {return d.color})
            .on('mousemove', mousemove)
            .on('mouseover', mouseover)
            .on('mouseleave', mouseleave)

            
            
            g
            .selectAll("vertLines")
            .data(averages)
            .enter()
            .append("line")
              .attr("x1", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2;})
              .attr("x2", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2;})
              .attr("y1", function(d){return yscale(d.lowerBound)})
              .attr("y2", function(d){return yscale(d.upperBound)})
              .attr("stroke", "black")
              .style("width", 40)

            console.log("no here")
              g
              .selectAll("horLinesTop")
              .data(averages)
              .enter()
              .append("line")
                .attr("x1", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2- Math.min(xScale.bandwidth()/4, 50);})
                .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2+ Math.min(xScale.bandwidth()/4, 50);})
                .attr("y1", function(d){return yscale(d.upperBound)})
                .attr("y2", function(d){return yscale(d.upperBound)})
                .attr("stroke", "black")
                .style("width", 40)
            console.log("actually here")
            g
            .selectAll("horLinesBottom")
            .data(averages)
            .enter()
            .append("line")
                .attr("x1", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2- Math.min(xScale.bandwidth()/4, 50);})
                .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2+ Math.min(xScale.bandwidth()/4, 50);})
                .attr("y1", function(d){return yscale(d.lowerBound)})
                .attr("y2", function(d){return yscale(d.lowerBound)})
                .attr("stroke", "black")
                .style("width", 40)


        if (config.zeroline === true){
            g.append("line")
            .attr("x1", 50)
            .attr("x2", width-widthMargin)
            .attr("y1", yscale(0))
            .attr("y2", yscale(0))
            .attr("stroke", "black")
            .style("width", 100)
        }
        function wrap(text, width) {
            text.each(function() {
                var text = d3.select(this),
                    words = text.text().split(/\s+/).reverse(),
                    word,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.1, // ems
                    y = text.attr("y"),
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em")
                while (word = words.pop()) {
                line.push(word)
                tspan.text(line.join(" "))
                if (tspan.node().getComputedTextLength() > width) {
                    line.pop()
                    tspan.text(line.join(" "))
                    line = [word]
                    tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", `${++lineNumber * lineHeight + dy}em`).text(word)
                }
                }
            })
        }

        }

    }

};



looker.plugins.visualizations.add(vis);