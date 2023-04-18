<template>
  <div id="map">
    <svg class="canvas" :viewBox="`0, 0, ${width}, ${height}`">
      <g id="basemap"></g>
      <text id="tooltip" x="150" y="150">{{displayedCountry}}</text>
    </svg>
  </div>
</template>


<script>
import json from "@/assets/world-topo-110m.json";
import { geoPath, geoEqualEarth } from "d3-geo";
import * as selection from "d3-selection";
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

      d3.selectAll('.' + "Source_" + code)
      .attr("stroke-opacity", 0.1)
      .attr("stroke-width", 0.5)
      .style("stroke", "lightgrey")
    }

    else {
      selectedCountries.add(code);
      d3.select(this) 
        .attr("stroke-width", 0.5)
        .style("opacity", 1)
        .style("stroke", "black");

        d3.selectAll('.' + "Source_" + code)
        .attr("stroke-width", 0.6)
        .attr("stroke-opacity", 0.6)
        .style("stroke", "orange")
    }
  };

    let colorScale = d3.scaleThreshold()
    .domain([100000, 1000000, 10000000, 30000000, 100000000, 500000000])
    .range(d3.schemePurples[7]);

    let populations = Object.assign({}, ...countries.map((x) => ({[x.code]: x.population})));

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


    let immigrations = new Object();

    for (let edge of edges){

      if (!immigrations[edge.source]) {
        immigrations[edge.source] = [];
      }
      immigrations[edge.source].push(edge.target);

      let coordinatesSource = citiesCoordinates[edge.source],
          coordinatesTarget = citiesCoordinates[edge.target];

      let p1 = this.projection(coordinatesSource),
          p2 = this.projection(coordinatesTarget);

      this.g.append("line")
        .attr("class", "Source_" + edge.source + " Target_" + edge.target)
        .attr("x1", p1[0])
        .attr("x2", p2[0])
        .attr("y1", p1[1])
        .attr("y2", p2[1])
        .attr("stroke-opacity", 0.1)
        .attr("stroke-width", 0.5)
        .style("stroke", "lightgrey")
    }
  }
};

</script>

<style lang="scss">
.country {
  fill: WhiteSmoke;
  stroke: Gainsboro;
}
#tooltip {
  font-size: 1.5rem;
}
.active {
  stroke: black;
}

.countries {
	fill: red;
	opacity:0.7;
}
</style>