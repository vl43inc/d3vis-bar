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

            default: 'large'

        }
        //add option for median instead of mean here? 

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
            const allFields = queryResponse.fields.dimensions.map((dim)=> dim.name)
            const allFieldsLabel = queryResponse.fields.dimensions.map((dim)=> dim.label_short)
            console.log("allFields", allFields) //gets names of each field
            const formattedData = new Map()
            for (const field of allFields){
                formattedData.set(field, data.map(elem => elem[field].value))
            }
            console.log("formattedData", formattedData) //map of data field name to array of data
            
            //calculate standard dev

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
            let zstar = 1.96;
            if (config.errorBars === '95CI') zstar = 1.960
            if (config.errorBars === '90CI') zstar = 1.645
            if(config.errorBars === '99CI') zstar = 2.576
            for (const catName of categoricalUnique){
                let catData = []
                for (let i=0; i<numberData.length; i++){
                    if (categoricalData[i] === catName){
                        catData.push(numberData[i])
                    }
                }
                let n = catData.length
                const std = getStandardDeviation(catData)
                const mean = d3.mean(catData)                
                const CIlowerBound = mean - zstar*std/Math.sqrt(n)
                const CIupperBound = mean + zstar*std/Math.sqrt(n)
                averages.push({category:catName, average: mean, std:std, CIlowerBound: CIlowerBound, CIupperBound:CIupperBound, n:n})
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

            //make axes labels
            svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "end")
            .attr("x", width)
            .attr("y", height-6)
            .text(allFieldsLabel[1])
            .style("padding", "10px");

            svg.append("text")
            .attr("class", "y label")
            .attr("text-anchor", "end")
            .attr("y", 6)
            .attr("dy", ".75em")
            .attr("transform", "rotate(-90)")
            .text(allFieldsLabel[2])


            const margin = 30;
            const g = svg.append('g')

            // Create scale
            const yscale = d3.scaleLinear()
            .domain([0, d3.max(numberData)])
            .range([height-40, 0]);

            // Add scales to axis
            let y_axis = d3.axisLeft()
                .scale(yscale);

            let xScale = d3.scaleBand().range ([0, width-margin]).domain(categoricalUnique.map((c)=> c)).padding(0.4)
            let x_axis = d3.axisBottom().scale(xScale)
            
            //Append group and insert axis
            g.append("g")
            .attr("transform", "translate(50, 0)")
            .call(y_axis);

            g.append("g")
            .attr("transform", "translate(50, "+(height - 40)+")")
            .call(x_axis);

            
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
                tooltip.html(`Num Measurements: ${d.n}`+ "<br/>" + `Mean: ${Math.round(d.average*100)/100}`);
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
            .attr("height", function(d) { return height - 40 - yscale(d.average); })
            .attr('fill', '#33658A')
            .on('mousemove', mousemove)
            .on('mouseover', mouseover)
            .on('mouseleave', mouseleave)

            //make standard dev error bars
            if (config.errorBars === 'std'){
            g
            .selectAll("vertLines")
            .data(averages)
            .enter()
            .append("line")
              .attr("x1", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2;})
              .attr("x2", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2;})
              .attr("y1", function(d){return yscale(d.average + d.std)})
              .attr("y2", function(d){return yscale(d.average - d.std)})
              .attr("stroke", "black")
              .style("width", 40)


              g
              .selectAll("horLinesTop")
              .data(averages)
              .enter()
              .append("line")
                .attr("x1", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2- Math.min(xScale.bandwidth()/4, 50);})
                .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2+ Math.min(xScale.bandwidth()/4, 50);})
                .attr("y1", function(d){return yscale(d.average + d.std)})
                .attr("y2", function(d){return yscale(d.average + d.std)})
                .attr("stroke", "black")
                .style("width", 40)

            g
            .selectAll("horLinesBottom")
            .data(averages)
            .enter()
            .append("line")
                .attr("x1", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2- Math.min(xScale.bandwidth()/4, 50);})
                .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2+ Math.min(xScale.bandwidth()/4, 50);})
                .attr("y1", function(d){return yscale(d.average - d.std)})
                .attr("y2", function(d){return yscale(d.average - d.std)})
                .attr("stroke", "black")
                .style("width", 40)
            
            }
            
            //make confidence interval error bars
            if (config.errorBars === '95CI' || config.errorBars === '90CI' || config.errorBars === '99CI'){
            g
            .selectAll("vertLines")
            .data(averages)
            .enter()
            .append("line")
              .attr("x1", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2;})
              .attr("x2", function(d){return xScale(d.category)+50 + xScale.bandwidth()/2;})
              .attr("y1", function(d){return yscale(d.CIupperBound)})
              .attr("y2", function(d){return yscale(d.CIlowerBound)})
              .attr("stroke", "black")
              .style("width", 40)


              g
              .selectAll("horLinesTop")
              .data(averages)
              .enter()
              .append("line")
                .attr("x1", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2- Math.min(xScale.bandwidth()/4, 50);})
                .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2+ Math.min(xScale.bandwidth()/4, 50);})
                .attr("y1", function(d){return yscale(d.CIupperBound)})
                .attr("y2", function(d){return yscale(d.CIupperBound)})
                .attr("stroke", "black")
                .style("width", 40)

            g
            .selectAll("horLinesBottom")
            .data(averages)
            .enter()
            .append("line")
                .attr("x1", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2- Math.min(xScale.bandwidth()/4, 50);})
                .attr("x2", function(d){return xScale(d.category)+50  + xScale.bandwidth()/2+ Math.min(xScale.bandwidth()/4, 50);})
                .attr("y1", function(d){return yscale(d.CIlowerBound)})
                .attr("y2", function(d){return yscale(d.CIlowerBound)})
                .attr("stroke", "black")
                .style("width", 40)


            }

        }

    }

};



looker.plugins.visualizations.add(vis);