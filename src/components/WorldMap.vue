<template>

    <svg id="legend" class="map-legend"></svg>
    <div id="itemList" :class="Object.keys(selectedCountries).length ? '' : 'd-none hidden'">
        <div class="d-flex justify-content-between">
            <h2 class="fs-6">Selected countries:</h2>
        </div>

    </div>

    <svg class="canvas" :viewBox="`0, 0, ${width}, ${height}`">
        <g id="basemap"></g>
        <text id="tooltip" x="150" y="150">{{ displayedCountry }}</text>
    </svg>

</template>


<script>
import json from "@/../public/data/world-topo-110m.json";
import {geoPath, geoEqualEarth} from "d3-geo";
import * as selection from "d3-selection";
import {sliderHorizontal} from 'd3-simple-slider';
import * as zoom from "d3-zoom";
import * as d3 from 'd3';
import {feature} from "topojson-client";

export default {
  name: "WorldMap",
  data() {
    return {
      myJson: feature(json, json.objects["countries"]),
      displayedCountry: "",
      width: 950,
      height: 550,
      selectedCountries: new Object(),
      amountsImmigrations: [],
      amountsEmigrations: [],
      differencesAmounts: [],
      maxAmount: [],
      flows: [],
      flowColors: [d3.rgb(0, 255, 255), 'orange'],
      emigrations: new Object(),
      immigrations: new Object(),
      differences: new Object(),
      directionMap: 'e',
      countries: [],
      countriesName: new Object(),
      edges: [],
      timestampsIds: {1990: 0, 1995: 1, 2000: 2, 2005: 3, 2010: 4, 2015: 5}
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
      return zoom.zoom().scaleExtent([1, 8]).on("zoom", this.zoomed);
    }
  },
  props: {
    direction: String,
    selection: String,
    startYearId: Number,
    endYearId: Number,
    migrationThreshold: Number
  },
  watch: {
    direction() {
    },
    selection() {
      let code = parseInt(this.selection);
      if (this.countriesNames[code] && this.selectedCountries[code] === undefined) {
        this.addCountry(code);
      }
    },
    startYearId() {
      this.filterBasedOnPeriod()
    },
    endYearId() {
      this.filterBasedOnPeriod()
    },
    migrationThreshold() {
      this.filterBasedOnThreshold()
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
    showLegend(width, height) {
      let svg = selection.select("#legend");
      let directions = ['immigrations', 'emigrations'];
      let colors = this.flowColors;
      const color = d3.scaleOrdinal(directions, colors);

      svg.append("rect")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", 150)
          .attr("height", directions.length * 25 + 50)
          .attr("fill", "rgb(44, 44, 135)")
          .attr("opacity", "1")
          .attr("stroke", "black")
          .attr("stroke-width", 1)
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("id", "legend");

      svg.append("text")
          .attr("x", 10)
          .attr("y", 20)
          .text("Legend:")
          .attr("font-weight", "bold")
          .style("fill", "white")
          .attr("alignment-baseline", "middle");

      svg.append("circle")
          .attr("cx", 10)
          .attr("cy", 50)
          .attr("r", 6)
          .style("fill", this.flowColors[1])
      svg.append("circle")
          .attr("cx", 10)
          .attr("cy", 80)
          .attr("r", 6)
          .style("fill", this.flowColors[0])
      svg.append("text")
          .attr("x", 20)
          .attr("y", 50)
          .text("emigrations")
          .style("font-size", "15px")
          .style("fill", "white")
          .attr("alignment-baseline", "middle")
      svg.append("text")
          .attr("x", 20)
          .attr("y", 80)
          .text("immigrations")
          .style("font-size", "15px")
          .style("fill", "white")
          .attr("alignment-baseline", "middle")
    },
    addCountry(code) {
      if (this.direction === 'e') this.flows = this.emigrations;
      else if (this.direction === 'i') this.flows = this.immigrations;
      else this.flows = this.differences;

      this.selectedCountries[code] = this.direction;
      this.addItem(code);

      this.svg.select('#' + "Country-" + code)
          .style("opacity", 1)
          .attr("stroke-width", 0.5)
          .style("stroke", "black")

      let targets = this.flows[code] || [];
      for (let target of targets) {
        let colorFlows, amount;
        let key = code + '-' + target;

        if (this.direction === 'e') {
          amount = this.amountsEmigrations[key] || 0;
          colorFlows = this.flowColors[1];
        } else if (this.direction === 'i') {
          amount = this.amountsImmigrations[key] || 0;
          colorFlows = this.flowColors[0];
        } else {
          amount = this.differencesAmounts[key] || 0;
          colorFlows = (amount > 0) ? this.flowColors[0] : this.flowColors[1];
        }

        let opacity;
        let width;

        if (Math.abs(amount) > this.migrationThreshold) {
          opacity = 0.4;
          width = Math.log10(amount);
        }
        else {
          opacity = 0.1;
          width = 0.5;
          colorFlows = "lightgrey";
        }

        let codes = [code, target];
        codes.sort();
        let idLine = 'id_' + codes[0] + '_' + codes[1];

        this.svg.select("#" + idLine)
            .attr("stroke-width", width)
            .attr("stroke-opacity", opacity)
            .style("stroke", colorFlows)
      }
    },
    select(event, d) {
      let code = d.id;
      if (this.selectedCountries[code] !== undefined) {
        document.getElementById('list-' + code).remove();
        delete this.selectedCountries[code]

        event.currentTarget.style.opacity = 0.8;
        event.currentTarget.style.stroke = "rgb(200, 0, 50)";
        event.currentTarget.style.width = 0.8;

        this.g.selectAll('.' + "country_" + code)
        .attr("stroke-opacity", 0.1)
        .attr("stroke-width", 0.5)
        .style("stroke", "lightgrey")
      }
      else {
        this.addCountry(code);
      }
    },
    mouseOver(event, d) {
      let code = d.id;
      if (this.selectedCountries[code] === undefined) {
        event.currentTarget.style.opacity = 0.8;
        event.currentTarget.style.stroke = "rgb(200, 0, 50)";
      }
    },
    mouseLeave(event, d) {
      let code = d.id;
      if (this.selectedCountries[code] === undefined) {
        event.currentTarget.style.opacity = 0.5;
        event.currentTarget.style.stroke = "transparent";
      }
    },
    calculateDifferences() {
      for (let country of this.countries) {
        let countryImmigrations = this.immigrations[country.code] || [];
        let countryEmigrations = this.emigrations[country.code] || [];
        let targets = [...new Set([...countryImmigrations, ...countryEmigrations])];

        if (!this.differences[country.code]) this.differences[country.code] = [];

        for (let target of targets) {
          let immigrationAmount = this.amountsImmigrations[(country.code + '-' + target)] || 0;
          let emigrationAmount = this.amountsEmigrations[(country.code + '-' + target)] || 0;
          let differenceCountry = immigrationAmount - emigrationAmount;

          this.differences[country.code].push(target);
          this.differencesAmounts[country.code + '-' + target] = differenceCountry;
        }
      }
    },
    update() {
      for (const [code, value] of Object.entries(this.selectedCountries)) {

        if (value === 'e') this.flows = this.emigrations;
        else if (value === 'i') this.flows = this.immigrations;
        else this.flows = this.differences;

        let targets = this.flows[code] || [];
        for (let target of targets) {
          let colorFlows, amount;
          let key = code + '-' + target;

          if (value === 'e') {
            amount = this.amountsEmigrations[key] || 0;
            colorFlows = this.flowColors[1];
          } else if (value === 'i') {
            amount = this.amountsImmigrations[key] || 0;
            colorFlows = this.flowColors[0];
          } else {
            amount = this.differencesAmounts[key] || 0;
            colorFlows = (amount > 0) ? this.flowColors[0] : this.flowColors[1];
          }

          let opacity;
          let width;

          if (Math.abs(amount) > this.migrationThreshold) {
            opacity = 0.4;
            width = Math.log10(amount);
          }
          else {
            opacity = 0.1;
            width = 0.5;
            colorFlows = "lightgrey";
          }

          let codes = [code, target];
          codes.sort();
          let idLine = 'id_' + codes[0] + '_' + codes[1];

          d3.select("#" + idLine)
              .attr("stroke-width", width)
              .attr("stroke-opacity", opacity)
              .style("stroke", colorFlows)
        }
      }
    },
    calculateSum(arr) {
      return arr.reduce((total, current) => {
        return total + current;
      }, 0);
    },
    filterBasedOnPeriod() {
      this.amountsEmigrations = Object.assign({}, ...this.edges.map((x) => ({[(x.source + '-' + x.target)]: this.calculateSum(x.total.slice(this.startYearId, this.endYearId + 1))})));
      this.amountsImmigrations = Object.assign({}, ...this.edges.map((x) => ({[(x.target + '-' + x.source)]: this.calculateSum(x.total.slice(this.startYearId, this.endYearId + 1))})));
      this.calculateDifferences();
      this.update();
    },
    filterBasedOnThreshold() {
      this.amountsEmigrations = Object.assign({}, ...this.edges.map((x) => ({[(x.source + '-' + x.target)]: this.calculateSum(x.total.slice(this.startYearId, this.endYearId + 1))})));
      this.amountsImmigrations = Object.assign({}, ...this.edges.map((x) => ({[(x.target + '-' + x.source)]: this.calculateSum(x.total.slice(this.startYearId, this.endYearId + 1))})));
      this.calculateDifferences();
      this.update();
    },
     async loadCoordinates() {
      let c = await d3.json("../../data/coordinates_countries.json");
      return c;
    },
    async loadCountries() {
      let c = await d3.json("../../data/countries.json");
      c.map(d => {
        d.group = d.region;
      });
      return c;
    },
    async loadEdges() {
      let c = await d3.json("../../data/migration.json");
      c = c.filter(d => d.total[5] > 10000);
      return c;
    },
    populateList() {
      for (const [code, value] of Object.entries(this.selectedCountries)) {
        this.addItem(code);
      }
    },
    addItem(code) {
      let listItem = document.createElement('li');
      listItem.id = 'list-' + code;
      listItem.innerHTML = this.countriesNames[code] || 'No countries on this territory';
      listItem.innerHTML += ("<span id='close-" + code + "' class='close' style='color:red;'> X</span>");
      listItem.addEventListener('click', (event) => {
        this.removeItem(code);
      });
      document.getElementById('itemList').appendChild(listItem);
    },
    removeItem(code) {
      document.getElementById('list-' + code).remove();
      delete this.selectedCountries[code];

      this.svg.select('#' + "Country-" + code)
          .style("opacity", 0.5)
          .attr("stroke-width", 0.5)
          .style("stroke", "transparent")

      this.g.selectAll('.' + "country_" + code)
      .attr("stroke-opacity", 0.1)
      .attr("stroke-width", 0.5)
      .style("stroke", "lightgrey")
    }
  },

  async mounted() {
    this.countries = await this.loadCountries();
    this.countriesNames = Object.assign({}, ...this.countries.map((x) => ({[x.code]: x.name})));
    this.edges = await this.loadEdges();

    let coordinatesCountries = await this.loadCoordinates();
 
    let test = Object.assign({}, ...this.edges.map((x) => ({[x.target]: x.source})));

    let colorScale = d3.scaleThreshold()
        .domain([100000, 1000000, 10000000, 30000000, 100000000, 500000000])
        .range(d3.schemePurples[7]);

    let populations = Object.assign({}, ...this.countries.map((x) => ({[x.code]: x.population})));

    this.amountsEmigrations = Object.assign({}, ...this.edges.map((x) => ({[(x.source + '-' + x.target)]: this.calculateSum(x.total)})));
    this.amountsImmigrations = Object.assign({}, ...this.edges.map((x) => ({[(x.target + '-' + x.source)]: this.calculateSum(x.total)})));
    this.maxAmount = Math.max(...Object.values(this.amountsEmigrations));

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
        .attr("id", function (d) {
          return "Country-" + d.id;
        })
        .style("stroke", "transparent")
        .attr("class", "Country")
        .style("opacity", .5)
        .on("mouseover", this.mouseOver)
        .on("mouseleave", this.mouseLeave)
        .on("click", this.select)

    this.svg
        .on("dblclick", this.reset).call(this.zoom)
        .on("dblclick", this.clicked);
    
    let citiesToDisplay = [];

    for (let country of this.countries) {

      let location = coordinatesCountries[String(country.code)];
      if (location !== undefined) {
        let coordinates = [location['Longitude (average)'], location['Latitude (average)']]
        let city = {
          "type": "Feature",
          "properties": {
              "country": country.name,
          },
          "geometry": {
              "coordinates": coordinates,
              "type": "Point"
          },
        };
        citiesToDisplay.push(city);
      }
    }

    this.g.selectAll()
        .data(citiesToDisplay)
        .join("path")
        .attr('d', this.path.pointRadius(0.5))
        .attr('class', 'cities')
        .style('opacity', 1)
        .style("fill", "grey")
        .style("stroke", "grey");

    for (let edge of this.edges) {

      edge.source = parseInt(edge.source);
      edge.target = parseInt(edge.target);

      let countrySource = coordinatesCountries[edge.source],
          countryTarget = coordinatesCountries[edge.target];
      
      if (countrySource !== undefined && countryTarget !== undefined)
      {

        if (this.emigrations[edge.source] !== undefined) this.emigrations[edge.source].push(edge.target);
        else this.emigrations[edge.source] = [edge.target];


        if (this.immigrations[edge.target] !== undefined) this.immigrations[edge.target].push(edge.source);
        else this.immigrations[edge.target] = [edge.source];

        let coordinatesSource = [countrySource['Longitude (average)'], countrySource['Latitude (average)']],
            coordinatesTarget = [countryTarget['Longitude (average)'], countryTarget['Latitude (average)']];

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
          .attr("stroke-opacity", 0.1)
          .attr("stroke-width", 0.5)
          .style("stroke", "lightgrey")
      }
    }

    let differences = new Object();
    this.differencesAmounts = new Object();
    this.calculateDifferences();

    this.showLegend(this.width, this.height);
  }
};

</script>

