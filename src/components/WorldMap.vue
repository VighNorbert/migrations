<template>

  <div id="map">

    <form id="form" class="btn-group btn-group-toggle" data-toggle="buttons">
      <label class="btn btn-secondary">
        <input type="radio" name="controlHeatmapType" value="emigrations" checked>Emigrations<br>
      </label>
      <label class="btn btn-secondary active">
        <input type="radio" name="controlHeatmapType" value="immigrations">Immigrations<br>
      </label>
      <label class="btn btn-secondary">
        <input type="radio" name="controlHeatmapType" value="differences">Differences<br>
      </label>
    </form>

    <svg class="canvas" :viewBox="`0, 0, ${width}, ${height}`">
      <g id="basemap"></g>
      <text id="tooltip" x="150" y="150">{{displayedCountry}}</text>
    </svg>

    <p id='value'></p>
    <div id="slider" style="margin: 0; width: 950px;"></div>

  </div>

</template>


<script>
import json from "@/assets/world-topo-110m.json";
import { geoPath, geoEqualEarth } from "d3-geo";
import * as selection from "d3-selection";
import { sliderHorizontal } from 'd3-simple-slider';
import * as zoom from "d3-zoom";
import * as d3 from 'd3';
import { feature } from "topojson-client";
export default {
  name: "WorldMap",
  data() {
    return {
      myJson: feature(json, json.objects["countries"]),
      displayedCountry: "",
      width: 950,
      height: 550
    };
  },
  computed: {
    projection() {
      return geoEqualEarth().fitSize([this.width, this.height], this.myJson);
    },
    path() {
      return geoPath().projection(this.projection);
    },
    g() {
      return selection.select("#basemap");
    },
    svg() {
      return selection.select(".canvas");
    },
    zoom() {
      return zoom
        .zoom()
        .scaleExtent([1, 8])
        .on("zoom", this.zoomed);
    }
  },
  methods: {
    zoomed(event) {
      this.g.attr("transform", event.transform);
      this.g.attr("stroke-width", 1 / event.transform.k);
    },
    clicked(event, d) {
      const [[x0, y0], [x1, y1]] = this.path.bounds(d);
      event.stopPropagation();
      this.svg
        .transition()
        .duration(750)
        .call(
          this.zoom.transform,
          zoom.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .scale(
              Math.min(
                8,
                0.9 / Math.max((x1 - x0) / this.width, (y1 - y0) / this.height)
              )
            )
            .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
          selection.pointer(this.svg.node())
        );
    },
    reset() {
      this.svg
        .transition()
        .duration(750)
        .call(
          this.zoom.transform,
          zoom.zoomIdentity,
          zoom
            .zoomTransform(this.svg.node())
            .invert([this.width / 2, this.height / 2])
        );
    },
     async loadCountries() {
      let c = await d3.json("../../data/countries.json");
      c.map(d => {
        d.group = d.region;
      });
      console.log(c);
      return c;
    },
    async loadEdges() {
      let c = await d3.json("../../data/migration.json");
      console.log(c);
      c = c.filter(d => d.total[5] > 10000);
      return c;
    },
  },

  async mounted() {
    let countries = await this.loadCountries();
    let edges = await this.loadEdges();
    let selectedCountries = new Set();
  
    let mouseOver = function(d) {
      let code = d.srcElement.__data__.id;
      if (!selectedCountries.has(code)) {
        d3.select(this)
          .transition()
          .duration(100)
          .style("opacity", 0.8)
          .style("stroke", "rgb(200, 0, 50)")
      }
    };

    let mouseLeave = function(d) {
      let code = d.srcElement.__data__.id;
      if (!selectedCountries.has(code)) {
        d3.select(this)
          .transition()
          .duration(100)
          .style("opacity", 0.5)
          .style("stroke", "transparent")
      }
    };

    let selected = function(d) {
      let code = d.srcElement.__data__.id;

      if (selectedCountries.has(code)) {
        selectedCountries.delete(code);
        d3.select(this)
        .transition()
        .duration(100)
        .style("opacity", 0.8)
        .style("stroke", "rgb(200, 0, 50)")

        d3.selectAll('.' + "country_" + code)
        .attr("stroke-opacity", 0.07)
        .attr("stroke-width", 0.5)
        .style("stroke", "lightgrey")
      }

      else {
        selectedCountries.add(code);
        d3.select(this) 
          .attr("stroke-width", 0.5)
          .style("opacity", 1)
          .style("stroke", "black");

        let targets = flows[code] || [];
        for (let target of targets) {
          let colorFlows, amount;
          let key = code + '-' + target;

          if (colorFlag == 'emigrations') {
            amount = amountsEmigrations[key] || 0;
            colorFlows = flowColors[1];
          }
          else if (colorFlag == 'immigrations') {
            amount = amountsImmigrations[key] || 0;
            colorFlows = flowColors[0];
          }
          else {
            amount = differencesAmounts[key] || 0;
            colorFlows = (amount > 0) ? flowColors[0] : flowColors[1];
          }

          let opacity = 0.3 + (amount / maxAmount) * 0.7;

          let codes = [code, target];
          codes.sort();
          let idLine = 'id_' + codes[0] + '_' + codes[1]; 

          d3.select("#" + idLine)
          .attr("stroke-width", 0.8)
          .attr("stroke-opacity", opacity)
          .style("stroke", colorFlows)
        }
      }
    };

     let update = function() {
      for (let code of selectedCountries) {
        let targets = flows[code] || [];
        for (let target of targets) {
          let colorFlows, amount;
          let key = code + '-' + target;

          if (colorFlag == 'emigrations') {
            amount = amountsEmigrations[key] || 0;
            colorFlows = flowColors[1];
          }
          else if (colorFlag == 'immigrations') {
            amount = amountsImmigrations[key] || 0;
            colorFlows = flowColors[0];
          }
          else {
            amount = differencesAmounts[key] || 0;
            colorFlows = (amount > 0) ? flowColors[0] : flowColors[1];
          }

          let opacity = 0.3 + (amount / maxAmount) * 0.7;

          let codes = [code, target];
          codes.sort();
          let idLine = 'id_' + codes[0] + '_' + codes[1]; 

          d3.select("#" + idLine)
          .attr("stroke-width", 0.8)
          .attr("stroke-opacity", opacity)
          .style("stroke", colorFlows)
        }
      }
    };

    let colorScale = d3.scaleThreshold()
    .domain([100000, 1000000, 10000000, 30000000, 100000000, 500000000])
    .range(d3.schemePurples[7]);

    let calculateSum = (arr) => {
      return arr.reduce((total, current) => {
          return total + current;
      }, 0);
    };

    let populations = Object.assign({}, ...countries.map((x) => ({[x.code]: x.population})));
    let amountsEmigrations = Object.assign({}, ...edges.map((x) => ({[(x.source + '-' + x.target)]: calculateSum(x.total)})));
    let amountsImmigrations = Object.assign({}, ...edges.map((x) => ({[(x.target + '-' + x.source)]: calculateSum(x.total)})));
    let maxAmount = Math.max(...Object.values(amountsEmigrations));
    let flowColors = [d3.rgb(0, 255, 255), 'orange'];
    let timestamps = [1990, 1995, 2000, 2005, 2010, 2015];
    let timestampsIds = {1990: 0, 1995: 1, 2000: 2, 2005: 3, 2010: 4, 2015: 5};

    this.g
    .selectAll("path")
    .data(this.myJson.features)
    .enter()
    .append("path")
      .attr("d", this.path) 
      .attr("fill", function (d) {
        let population = populations[d.id] || 0;
        return colorScale(population);
      })
      .style("stroke", "transparent")
      .attr("class", "Country")
      .style("opacity", .5)
      .on("mouseover", mouseOver)
      .on("mouseleave", mouseLeave)
      .on("click", selected)

    this.svg
    .on("dblclick", this.reset).call(this.zoom)
    .on("dblclick", this.clicked);

    let citiesCoordinates = Object.assign({}, ...countries.map((x) => ({[x.code]: x.location})));

    let citiesToDisplay = [];

    for (let country of countries) {
      let city = {
            "type": "Feature",
            "properties": {
                "country": country.name,
            },
            "geometry": {
                "coordinates": country.location.reverse(),
                "type": "Point"
            },
        };
      citiesToDisplay.push(city);
    }

    this.g.selectAll()
      .data(citiesToDisplay)
      .join("path")
      .attr('d', this.path.pointRadius(0.5))
      .attr('class', 'cities')
      .style('opacity', 1)
      .style("fill", "grey")
      .style("stroke", "grey");

    let emigrations = new Object();
    let immigrations = new Object();
    
    for (let edge of edges) {

      if (!emigrations[edge.source]) emigrations[edge.source] = [];
      if (!immigrations[edge.target]) immigrations[edge.target] = [];

      emigrations[edge.source].push(edge.target);
      immigrations[edge.target].push(edge.source);

      let coordinatesSource = citiesCoordinates[edge.source],
          coordinatesTarget = citiesCoordinates[edge.target];

      let p1 = this.projection(coordinatesSource),
          p2 = this.projection(coordinatesTarget);

      let codes = [edge.target, edge.source];
      codes.sort();
      let idLine = 'id_' + codes[0] + '_' + codes[1]; 
      let class1 = "country_" + edge.target;
      let class2 = "country_" + edge.source;

      this.g.append("line")
        .attr("id", idLine)
        .attr("class", class1 + ' ' + class2)
        .attr("x1", p1[0])
        .attr("x2", p2[0])
        .attr("y1", p1[1])
        .attr("y2", p2[1])
        .attr("stroke-opacity", 0.07)
        .attr("stroke-width", 0.5)
        .style("stroke", "lightgrey")
    }


    let differences = new Object();
    let differencesAmounts = new Object();

    let calculateDifferences = function() {
      for (let country of countries) {
        let countryImmigrations = immigrations[country.code] || [];
        let countryEmigrations = emigrations[country.code] || [];
        let targets = [...new Set([...countryImmigrations, ...countryEmigrations])];

        if (!differences[country.code]) differences[country.code] = [];

        for (let target of targets) {
          let immigrationAmount = amountsImmigrations[(country.code + '-' + target)] || 0;
          let emigrationAmount = amountsEmigrations[(country.code + '-' + target)] || 0;
          let differenceCountry = immigrationAmount - emigrationAmount;
          
          differences[country.code].push(target);
          differencesAmounts[country.code + '-' + target] = differenceCountry;
        }
      }
    }

    calculateDifferences();

    let flows = emigrations;
    let colorFlag = 'emigrations';

    let buttons = d3.selectAll('input');
    buttons.on('change', function() {
      colorFlag = this.value;
      if (this.value == 'emigrations') {
        flows = emigrations;
      } else if (this.value == 'immigrations') {
        flows = immigrations;
      } else {
        flows = differences;
      }
    });

    var slider = sliderHorizontal()
    .min(1990)
    .max(2015)
    .value([1990, 2015])
    .width(1400)
    .step(5)
    .tickValues(timestamps)
    .tickFormat(d3.format("d"))
    .displayValue(false)
    .on('onchange', (value) => {
      let startYearId = timestampsIds[value[0]];
      let endYearId = timestampsIds[value[1]];

      amountsEmigrations = Object.assign({}, ...edges.map((x) => ({[(x.source + '-' + x.target)]: calculateSum(x.total.slice(startYearId, endYearId + 1))})));
      amountsImmigrations = Object.assign({}, ...edges.map((x) => ({[(x.target + '-' + x.source)]: calculateSum(x.total.slice(startYearId, endYearId + 1))})));

      calculateDifferences();

      update();
    });
  
  d3.select('#slider')
    .append('svg')
    .attr('width', 1450)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(slider);
  }
};

</script>

