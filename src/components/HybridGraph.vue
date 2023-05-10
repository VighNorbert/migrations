<template>
    <div class="sliderDiv">
        <button @click="showSidebar()" class="btn btn-sm btn-secondary" id="sidebar-toggler">Show sidebar</button>
    </div>
    <div class="map-canvas card">
    </div>
    <div class="container">
        <div id="sidebar" class="sidebar" style="display: none; visibility: hidden;">
            <!-- Sidebar content goes here -->
            <div class="d-flex jusify-content-start align-items-center">
                <button type="button" class="btn-close me-3" @click="closeSidebar()"></button>
                <h2 class="fs-4 my-2">Details</h2>
            </div>

            <!--

              selected country migration details

            -->

            <div id="selected-country-details">
                <div id="details-list-div">
                    <ul id="details-list">

                    </ul>
                </div>
                <svg id="sidebarCountryDetailsBoxPlot" style="height: 900px;">

                </svg>
            </div>
        </div>
    </div>
</template>

<script>
import * as d3 from 'd3';

var overedChordDiagramZoneName = "";
let isChordDiagramOvered = false;
var selectedCountries = [];
let multipleSelectionActive = false;
let migrationsFlowsDetails = {};
let ctrlPressed = false;
let data = {};
let viewOption = "emigration";
let lastOveredZone = "";
let showDifferenceColors = false;
let selectedStartYear = 0;
let selectedEndYear = 5;
let selectedThreshold = 0;

export default {
  name: 'HybridGraph',
  watch: {
    direction() {
      //this.nodeClicked(this.root, false);
      // TODO implement difference
      if (this.direction === "i") {
        this.showImmigration();
      } else if (this.direction === "e") {
        this.showEmigration();
      } else {
        this.showDifference();
      }
      this.updateDiagram();
    },
    selection() {
      /*if (this.selection !== this.root) {
        this.nodeClicked(this.selection);        
      }*/

      selectedCountries = [];

      let countryName = this.code2country_dict[this.selection];
      multipleSelectionActive = true;

      // if country in set then remove it, otherwise insert it
      let elementIndex = selectedCountries.indexOf(countryName);
      if (elementIndex == -1) {
        selectedCountries.push(countryName);
        multipleSelectionActive = true;
      } else {
        selectedCountries.splice(elementIndex, 1);
        if (selectedCountries.length == 0)
          multipleSelectionActive = false;
      }

      this.reduceOpacityOfAllCountriesLinks(0.05);
      this.reduceOpacityOfAllCountriesFlags(0.1);

      this.increaseLinksOpacityOfSelectedCountries(selectedCountries, 0.7);
      this.highlightSelectedLinkedCountries(selectedCountries, 0.45);
      let selectedCountriesComposed = [];
      selectedCountries.forEach(function (countryName) {
        selectedCountriesComposed.push({"country": countryName});
      });
      this.increaseFlagOpacityOfSelectedCountries(selectedCountriesComposed, 1);

    },
    startYearId() {
      this.selectedStartYear = this.startYearId * 5 + 1990;
      this.updateDiagram();
    },
    endYearId() {
      this.selectedEndYear = this.endYearId * 5 + 1990;
      this.updateDiagram();

    },
    migrationThreshold() {
      this.selectedThreshold = this.migrationThreshold;
      this.updateDiagram();
    }
  },
  props: {
    direction: String,
    selection: String,
    startYearId: Number,
    endYearId: Number,
    migrationThreshold: Number
  },
  async mounted() {
    let dataAsync = await this.loadData();
    data = dataAsync;
    let summData = this.summarizeData(data, 0, 2000, 100000);
    //summData = this.summarizeData(data,0,1970,0);

    //let diagram = await this.loadDiagram();
    let diagram = summData;
    let iso3166 = await this.loadIso3166();
    this.iso3166 = iso3166;
    this.HybridGraph(diagram, iso3166);
  },
  methods: {
    async loadDiagram() {
      let d = await d3.json("../../data/hybrid.json");
      return d;
    },
    async loadIso3166() {
      let d = await d3.json("../../data/config/iso3166_dict.json");
      return d;
    },
    async loadData() {
      let countries = await d3.json("../../data/countries.json");
      let years = [1990, 1995, 2000, 2005, 2010, 2015, 2020];

      let code2country_dict = {};
      countries.forEach(function (country) {
        code2country_dict[country.code] = country.name;
      });
      this.code2country_dict = code2country_dict;

      let zones = await d3.json("../../data/config/zones.json");

      let migrations = await d3.json("../../data/migration.json");

      let diagramDataStructure = {};
      diagramDataStructure.chordDiagrams = {};
      diagramDataStructure.externalLinks = {};
      diagramDataStructure.isolatedNodes = {};

      // now I have to build the skeleton data structure
      let country2continent = await d3.json("../../data/config/country_continent_mapping.json");
      let country2continent_dict = {};
      country2continent.mapping.forEach(function (c2c) {
        let country = c2c.country;
        let continent = c2c.continent;

        country2continent_dict[country] = continent;

        if (!(continent in diagramDataStructure.chordDiagrams)) {
          diagramDataStructure.chordDiagrams[continent] = {};
          diagramDataStructure.chordDiagrams[continent]["x"] = zones[continent]["x"];
          diagramDataStructure.chordDiagrams[continent]["y"] = zones[continent]["y"];
          diagramDataStructure.chordDiagrams[continent]["radius"] = zones[continent]["radius"];
          diagramDataStructure.chordDiagrams[continent]["nodes"] = {};
        }

        diagramDataStructure.chordDiagrams[continent]["nodes"][country] = {};
        diagramDataStructure.chordDiagrams[continent]["nodes"][country]["name"] = country;
        diagramDataStructure.chordDiagrams[continent]["nodes"][country]["links"] = {};
      });

      this.country2continent_dict = country2continent_dict;

      migrations.forEach(function (migration, index) {
        migrations[index].source = code2country_dict[migration.source];
        migrations[index].target = code2country_dict[migration.target];

        let sourceCountry = migrations[index].source;
        let targetCountry = migrations[index].target;
        let quantities = migrations[index].total;

        let flowQuantities = {};
        quantities.forEach(function (quantity, index) {
          flowQuantities[years[index]] = quantity;
        });

        if (country2continent_dict[sourceCountry] !== undefined && country2continent_dict[targetCountry] !== undefined) {
          if (country2continent_dict[sourceCountry] === country2continent_dict[targetCountry]) {
            // insert as internal migration
            if (!(targetCountry in diagramDataStructure.chordDiagrams[country2continent_dict[sourceCountry]]["nodes"][sourceCountry]["links"])) {
              diagramDataStructure.chordDiagrams[country2continent_dict[sourceCountry]]["nodes"][sourceCountry]["links"][targetCountry]
                  = {"in": {}, "out": {}};
            }

            if (!(sourceCountry in diagramDataStructure.chordDiagrams[country2continent_dict[targetCountry]]["nodes"][targetCountry]["links"])) {
              diagramDataStructure.chordDiagrams[country2continent_dict[targetCountry]]["nodes"][targetCountry]["links"][sourceCountry]
                  = {"in": {}, "out": {}};
            }

            diagramDataStructure.chordDiagrams[country2continent_dict[sourceCountry]]["nodes"][sourceCountry]["links"][targetCountry].out = flowQuantities;
            diagramDataStructure.chordDiagrams[country2continent_dict[targetCountry]]["nodes"][targetCountry]["links"][sourceCountry].in = flowQuantities;
          } else {
            // insert as external migration
            if (!(normalizeExternalLinkKey(sourceCountry, targetCountry) in diagramDataStructure.externalLinks)) {
              diagramDataStructure["externalLinks"][normalizeExternalLinkKey(sourceCountry, targetCountry)]
                  = {"from": sourceCountry, "to": targetCountry, "peso": {"in": {}, "out": {}}, "weight": {}};
            }

            if (!(normalizeExternalLinkKey(targetCountry, sourceCountry) in diagramDataStructure.externalLinks)) {
              diagramDataStructure["externalLinks"][normalizeExternalLinkKey(targetCountry, sourceCountry)]
                  = {"from": targetCountry, "to": sourceCountry, "peso": {"in": {}, "out": {}}, "weight": {}};
            }

            diagramDataStructure["externalLinks"][normalizeExternalLinkKey(sourceCountry, targetCountry)].peso.out = flowQuantities;
            diagramDataStructure["externalLinks"][normalizeExternalLinkKey(targetCountry, sourceCountry)].peso.in = flowQuantities;
          }
        }
      });

      function normalizeExternalLinkKey(from, to) {
        return from + "-" + to;
      }

      return diagramDataStructure;
    },
    normalizeExternalLinkKey(from, to) {
      return from + "-" + to;
    },
    updateDiagram() {
      let startYear = this.selectedStartYear;
      let endYear = this.selectedEndYear; // document.getElementById("yearSlider").value;

      let minFilter = this.selectedThreshold; // document.getElementById("filterSlider").value;

      if (startYear === undefined)
        startYear = 1990;
      if (endYear === undefined)
        endYear = 2020;
      if (minFilter === undefined)
        minFilter = 0;

      let summData = this.summarizeData(data, startYear, endYear, minFilter);

      //let diagram = await this.loadDiagram();
      let diagram = summData;
      let iso3166 = this.iso3166;

      this.removeElement("chordlink");

      this.HybridGraph(diagram, iso3166);
    },
    showImmigration() {
      viewOption = "immigration";
      this.updateDiagram();
    },
    showEmigration() {
      viewOption = "emigration";
      this.updateDiagram();
    },
    showDifference() {
      showDifferenceColors = !showDifferenceColors;
      // make internal links with opacity to 0
      this.updateDiagram();
      this.reduceOpacityOfAllCountriesLinks(0.05);
    },
    summarizeData(fullDiagramData, fromYear, toYear, minFilter) {

      let fullDiagramDataCopy = fullDiagramData;
      migrationsFlowsDetails = {};
      //fullDiagramDataCopy = JSON.parse(JSON.stringify(fullDiagramData));

      // work on internal migrations
      Object.keys(fullDiagramDataCopy.chordDiagrams).forEach(function (zone) {
        let diagramZone = fullDiagramDataCopy.chordDiagrams[zone];

        Object.keys(diagramZone.nodes).forEach(function (diagramNodeName) {
          let diagramNode = diagramZone.nodes[diagramNodeName];

          let nodeLinks = diagramNode.links;

          if (!(diagramNodeName in migrationsFlowsDetails)) {
            migrationsFlowsDetails[diagramNodeName] = {"in": 0, "out": 0, "max": 0};
          }

          Object.keys(nodeLinks).forEach(function (nodeLink) {

            let nodeLinkCountry = nodeLink;
            if (!(nodeLinkCountry in migrationsFlowsDetails)) {
              migrationsFlowsDetails[nodeLinkCountry] = {"in": 0, "out": 0, "max": 0};
            }

            let migrationsOut = 0;
            let migrationsIn = 0;

            if (Object.keys(nodeLinks[nodeLink].out).length > 0) {
              let linkOut = nodeLinks[nodeLink].out;

              Object.keys(linkOut).forEach(function (year) {
                if (year >= fromYear && year <= toYear)
                  migrationsOut += linkOut[year];
              });
            }

            if (Object.keys(nodeLinks[nodeLink].in).length > 0) {
              let linkIn = nodeLinks[nodeLink].in;

              Object.keys(linkIn).forEach(function (year) {
                if (year >= fromYear && year <= toYear)
                  migrationsIn += linkIn[year];
              });
            }

            if (migrationsIn > minFilter) {
              migrationsFlowsDetails[diagramNodeName].in += migrationsIn;
            }

            if (migrationsOut > minFilter) {
              migrationsFlowsDetails[diagramNodeName].out += migrationsOut;
            }

            // update the max, according to viewoption
            if (viewOption == "immigration") {
              if (migrationsIn > minFilter) {
                nodeLinks[nodeLink].quantity = migrationsIn;
              } else {
                nodeLinks[nodeLink].quantity = 0;
              }
              if (migrationsIn > migrationsFlowsDetails[diagramNodeName].max)
                migrationsFlowsDetails[diagramNodeName].max = migrationsIn;
            } else if (viewOption == "emigration") {
              if (migrationsOut > minFilter) {
                nodeLinks[nodeLink].quantity = migrationsOut;
              } else {
                nodeLinks[nodeLink].quantity = 0;
              }
              if (migrationsOut > migrationsFlowsDetails[diagramNodeName].max)
                migrationsFlowsDetails[diagramNodeName].max = migrationsOut;
            }
          });

        });
      });

      // work on external migrations
      Object.keys(fullDiagramDataCopy.externalLinks).forEach(function (externalLink) {
        let from = fullDiagramDataCopy.externalLinks[externalLink].from;
        let to = fullDiagramDataCopy.externalLinks[externalLink].to;
        let weights = fullDiagramDataCopy.externalLinks[externalLink];

        let sumWeights = 0;

        sumWeights = weights[toYear];

        if (sumWeights > minFilter)
          fullDiagramDataCopy.externalLinks[externalLink].weight = sumWeights;
        else
          fullDiagramDataCopy.externalLinks[externalLink].weight = 0;

        if (migrationsFlowsDetails[from] !== undefined) {
          if (sumWeights > migrationsFlowsDetails[from].max) {
            migrationsFlowsDetails[from].max = sumWeights;
          }
        }

      });

      return fullDiagramDataCopy;
    },
    HybridGraph(diagram, iso3166) {
      let diameter = 500;
      let radius = diameter / 2;
      let innerRadius = radius - 120;

      this.cluster = d3.cluster().size([360, innerRadius]);

      this.svg = d3.create("svg")
          .attr("viewBox", [0, 0, 1920, 1080])
          .attr("width", 1920)
          .attr("height", 1080)
          .attr("id", "chordlink")
          .append("g")
          .attr("transform", "translate(" + radius + "," + radius + ")")
      ;

      document.querySelector(".map-canvas").appendChild(this.svg.node().parentNode);

      d3.select("#chordlink").append("g").attr("id", "externalLinks")
          .attr("transform", "translate(-10,-225)");

      d3.select("body")
          .on("keydown", function (event) {
            ctrlPressed = true;
          })
          .on("keyup", function (event) {
            ctrlPressed = false;
          });

      this.tooltip = d3.select(".map-canvas")
          .append("div")
          .style("opacity", 0)
          .attr("class", "tooltip")
          .style("background-color", "white")
          .style("border", "solid")
          .style("border-width", "2px")
          .style("border-radius", "5px")
          .style("padding", "5px")
          .style("position", "absolute")
      ;

      this.line = d3.radialLine()
          .curve(d3.curveBundle.beta(0.85))
          .radius(function (d) {
            if (d != null) return d.y;
            return 0;
          })
          .angle(function (d) {
            if (d != null)
              return d.x / 180 * Math.PI;
            return 0;
          });

      this.drawChordDiagrams(diagram, iso3166);

      let reduceOpacityOfAllCountriesFlags = this.reduceOpacityOfAllCountriesFlags;
      let highlightSelectedCountries = this.highlightSelectedCountries;
      let reduceOpacityOfAllCountriesLinks = this.reduceOpacityOfAllCountriesLinks;
      let increaseLinksOpacityOfSelectedCountries = this.increaseLinksOpacityOfSelectedCountries;
      let drawExternalLinksOfSelectedCountries = this.drawExternalLinksOfSelectedCountries;
      let highlightSelectedLinkedCountries = this.highlightSelectedLinkedCountries;

      if (multipleSelectionActive) {
        // highlight selected countries
        highlightSelectedLinkedCountries(selectedCountries, 0.45);

        // remove highlight on everything
        reduceOpacityOfAllCountriesFlags(0.1);
        reduceOpacityOfAllCountriesLinks(0.05);

        highlightSelectedCountries();
        increaseLinksOpacityOfSelectedCountries(selectedCountries, 0.7);

        drawExternalLinksOfSelectedCountries(selectedCountries);
      }
    },
    drawChordDiagrams(diagram, iso3166) {

      this.link = {};
      this.node = {};

      this.chordDiagrams = diagram.chordDiagrams;
      this.externalLinks = diagram.externalLinks;
      this.isolatedNodes = diagram.isolatedNodes;

      let drawChordDiagram = this.drawChordDiagram;

      let chordDiagrams = this.chordDiagrams;

      // get all the countries names
      this.countryNames = this.getCountryNames(diagram);
      //let countryNamesSet = new Set(countryNames);

      // build iso3166 dict
      let iso3166_dict = {};
      iso3166.mappings.forEach(function (country) {
        iso3166_dict[country["Name"]] = country["Code"];
      });

      this.iso3166_dict = iso3166_dict;

      let country2zone_dict = {};
      this.country2zone_dict = country2zone_dict;

      Object.keys(chordDiagrams).forEach(function (chordDiagramZone) {
        drawChordDiagram(chordDiagramZone);
      });

    },

    // draws the triangles around the zone
    drawGuidePoints(zoneName) {

      let normalizeZoneName = this.normalizeZoneName;

      let radius = 150;

      let configurations = [{"x": -radius, "y": -radius, "rotation": -45}, {"x": radius, "y": -radius, "rotation": 45},
        {"x": radius, "y": radius, "rotation": 135}, {"x": -radius, "y": radius, "rotation": -135}];


      let i = 1;
      configurations.forEach(function (conf) {
        let x = conf.x;
        let y = conf.y;
        let angle = conf.rotation;

        var sym = d3.symbol().type(d3.symbolTriangle).size(100);
        d3.select("#g-" + normalizeZoneName(zoneName))
            .append("path")
            .attr("d", sym)
            .attr("id", "triangle-" + normalizeZoneName(zoneName) + "-" + i)
            .attr("class", "triangle")
            .attr("fill", "steelblue")
            .attr("transform", "translate(" + x + ", " + y + ")rotate(" + angle + ")");

        i++;
      });

    },
    createIsolatedNode(countryName, iso3166_dict) {
      let highlightLinksFromCountry = this.highlightLinksFromCountry;
      let removeHighlightsLinksFromCountry = this.removeHighlightsLinksFromCountry;
      let deleteChordDiagram = this.deleteChordDiagram;
      let removeElement = this.removeElement;
      let normalizeClassName = this.normalizeClassName;
      let chordDiagrams = this.chordDiagrams;
      let isolatedNodes = this.isolatedNodes;
      let externalLinks = this.externalLinks;
      let deleteExternalLink = this.deleteExternalLink;
      let pushExternalLink = this.pushExternalLink;
      let drawChordDiagram = this.drawChordDiagram;
      let country2continent_dict = this.country2continent_dict;
      let normalizeExternalLinkKey = this.normalizeExternalLinkKey;
      let highlightSelectedCountries = this.highlightSelectedCountries;
      let getIsolatedNodes = this.getIsolatedNodes;
      let moveCountryToZone = this.moveCountryToZone;
      let showTooltipCountry = this.showTooltipCountry;
      let showMigrationDetailsList = this.showMigrationDetailsList;
      let hideTooltipCountry = this.hideTooltipCountry;
      let overlap = this.overlap;

      // delete old node
      removeElement("node-" + normalizeClassName(countryName));

      d3.select("svg#chordlink")
          .append("g")
          .attr("id", "g-isolated-node-" + normalizeClassName(countryName))
          .attr("class", "g-isolated-node")
      ;

      d3.select("#g-isolated-node-" + normalizeClassName(countryName))
          .append("image")
          .attr("class", "g-isolated-node")
          .attr("href", function () {
            return require('@/assets/img/w20/' + iso3166_dict[countryName].toString().toLowerCase() + '.png');
          })
          .attr("data-country", countryName)
          .attr("id", "node-" + normalizeClassName(countryName))
          .on("mouseover", isolatedNodeMouseovered)
          .on("mouseout", isolatedNodeMouseouted)
          .call(d3.drag()
              .on('start', isolatedNodeDragStart)
              .on('drag', isolatedNodeDragging)
              .on('end', isolatedNodeDragEnd)
          );

      function isolatedNodeDragStart() {
        d3.select(this).style("stroke", "");
      }

      function isolatedNodeDragging(event) {
        var xCoor = event.x;
        var yCoor = event.y;

        d3.select(this).attr("transform", "translate(" + xCoor + "," + yCoor + ")");
      }

      function isolatedNodeDragEnd() {
        let currentCircle = document.getElementById("circle-" + normalizeClassName(lastOveredZone));
        let isolatedFlag = document.getElementById("node-" + normalizeClassName(countryName));

        if (overlap(currentCircle, isolatedFlag)) {
          moveCountryToZone(countryName, overedChordDiagramZoneName);
        }
      }

      function isolatedNodeMouseovered(d, event) {
        let overedCountryName = d.target.dataset.country;
        highlightLinksFromCountry(overedCountryName);

        showTooltipCountry(overedCountryName, migrationsFlowsDetails[overedCountryName].in,
            migrationsFlowsDetails[overedCountryName].out, event);

        showMigrationDetailsList(overedCountryName);
      }

      function isolatedNodeMouseouted(d) {
        let overedCountryName = d.target.dataset.country;
        hideTooltipCountry();
        removeHighlightsLinksFromCountry(overedCountryName);
      }

    },
    /** **************************************************
     ************ CHORD DIAGRAM DRAWING ZONE  * **********
     *****************************************************/

    drawChordDiagram(chordDiagramZone) {
      let hierarchy = this.hierarchy;
      let cluster = this.cluster;
      let drawGuidePoints = this.drawGuidePoints;
      let drawChordDiagramCanvas = this.drawChordDiagramCanvas;
      let drawChordDiagramFlags = this.drawChordDiagramFlags;
      let drawChordDiagramInternalLinks = this.drawChordDiagramInternalLinks;

      let chordDiagrams = this.chordDiagrams;
      let country2zone_dict = this.country2zone_dict;

      drawChordDiagramCanvas(chordDiagramZone);

      const containsKey = (obj, key) => Object.keys(obj).includes(key);
      let arr = [];
      let dict = chordDiagrams[chordDiagramZone].nodes;
      for (var key in dict) {
        if (containsKey(dict, key)) {
          arr.push([key, dict[key]]);
        }
        country2zone_dict[key] = chordDiagramZone;
      }
      let zoneCountries = hierarchy(arr);
      cluster(zoneCountries);

      drawChordDiagramFlags(chordDiagramZone, zoneCountries);

      drawGuidePoints(chordDiagramZone);
      drawChordDiagramInternalLinks(chordDiagramZone, zoneCountries);
    },
    drawChordDiagramCanvas(chordDiagramZone) {
      let chordDiagrams = this.chordDiagrams;
      let chorDiagramMouseoveredGlob = this.chorDiagramMouseoveredGlob;
      let normalizeClassName = this.normalizeClassName;

      /** APPEND SINGLE CHORD DIAGRAM TO SVG  */
      this.node[chordDiagramZone] = this.svg.append("g")
          .attr("id", "g-" + normalizeClassName(chordDiagramZone))
          .attr("class", "chord-diagram")
          .attr("transform", function () {
            return "translate(" + chordDiagrams[chordDiagramZone].x + "," + chordDiagrams[chordDiagramZone].y + ")";
          })
          .call(d3.drag()
              .on('start', chordDiagramDragStart)
              .on('drag', chordDiagramDragging)
              .on('end', chordDiagramDragEnd)
          )
          //.on("mouseover", chorDiagramMouseovered)
          //.on("mouseout", chorDiagramMouseouted)
          .selectAll(".node");

      /** CHORD DIAGRAM EVENTS  */
      function chorDiagramMouseovered(e) {
        isChordDiagramOvered = true;
        lastOveredZone = chordDiagramZone;
        chorDiagramMouseoveredGlob(chordDiagramZone);
      }

      function chorDiagramMouseouted(e) {
        isChordDiagramOvered = false;
      }

      function chordDiagramDragStart() {
        d3.select(this)
            .style("stroke", "")
      }

      function chordDiagramDragging(event) {
        var xCoor = event.x;
        var yCoor = event.y;

        d3.select(this)
            .attr("transform", "translate(" + xCoor + "," + yCoor + ")");
      }

      function chordDiagramDragEnd() {
      }

      // append a rect to g for letting drag options
      d3.select("#g-" + this.normalizeClassName(chordDiagramZone)).append("rect")
          .attr("width", "400px")
          .attr("height", "400px")
          .attr("transform", "translate(-200,-200)")
          .style('opacity', 0);

      // append a circle to g for letting drag options
      d3.select("#g-" + this.normalizeClassName(chordDiagramZone)).append("circle")
          .on("mouseover", chorDiagramMouseovered)
          .on("mouseout", chorDiagramMouseouted)
          .attr("r", "170")
          .attr("id", "circle-" + this.normalizeClassName(chordDiagramZone))
          .attr("fill", "white")
          .style('opacity', 1);
    },

    drawChordDiagramFlags(chordDiagramZone, zoneCountries) {

      let iso3166_dict = this.iso3166_dict;
      let createIsolatedNode = this.createIsolatedNode;
      let countryNames = this.countryNames;
      let deleteChordDiagram = this.deleteChordDiagram;
      let country2zone_dict = this.country2zone_dict;
      let highlightSelectedCountries = this.highlightSelectedCountries;
      let moveCountryToIsolatedNodes = this.moveCountryToIsolatedNodes;
      let drawChordDiagram = this.drawChordDiagram;
      let highlightLinksFromCountry = this.highlightLinksFromCountry;
      let removeHighlightsLinksFromCountry = this.removeHighlightsLinksFromCountry;
      let reduceOpacityOfAllCountriesLinks = this.reduceOpacityOfAllCountriesLinks;
      let reduceOpacityOfAllCountriesFlags = this.reduceOpacityOfAllCountriesFlags;
      let increaseLinksOpacityOfSelectedCountries = this.increaseLinksOpacityOfSelectedCountries;
      let increaseFlagOpacityOfSelectedCountries = this.increaseFlagOpacityOfSelectedCountries;
      let normalizeClassName = this.normalizeClassName;
      let showTooltipCountry = this.showTooltipCountry;
      let hideTooltipCountry = this.hideTooltipCountry;
      let showMigrationDetailsList = this.showMigrationDetailsList;
      let setColorOffAllLinks = this.setColorOffAllLinks;
      let hideMigrationDetails = this.hideMigrationDetails;
      let highlightSelectedLinkedCountries = this.highlightSelectedLinkedCountries;
      let showMigrationBarChartForCountry = this.showMigrationBarChartForCountry;

      /** Draw all the flags */
      this.node[chordDiagramZone] = this.node[chordDiagramZone]
          .data(zoneCountries.leaves())
          .enter().append("image")
          .attr("class", function () {
            return "node flag chord-diagram-text node-" + normalizeClassName(chordDiagramZone);
          })
          .attr("data-country", function (d) {
            return d.data.key;
          })
          .attr("id", function (d) {
            return "node-" + normalizeClassName(d.data.key);
          })
          .attr("transform", function (d) {
            return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 10) + ",0)";// + (d.x < 180 ? "" : "rotate(180)");
          })
          .attr("href", function (d) {
            if (d.data.key !== undefined && iso3166_dict[d.data.key] !== undefined)
              return require('@/assets/img/w20/' + iso3166_dict[d.data.key].toString().toLowerCase() + '.png');
            else
              return "";
          })
          .on("mouseover", flagMouseOvered)
          .on("mouseout", flagMouseOuted)
          .on("click", flagMouseClick)
      ;

      /** CHORD DIAGRAMS FLAGS EVENTS */
      function flagMouseClick(d) {

        if (ctrlPressed) {
          let countryName = d.target.__data__.data.name;

          // if country in set then remove it, otherwise insert it
          let elementIndex = selectedCountries.indexOf(countryName);
          if (elementIndex == -1) {
            selectedCountries.push(countryName);
            multipleSelectionActive = true;
          } else {
            selectedCountries.splice(elementIndex, 1);
            if (selectedCountries.length == 0)
              multipleSelectionActive = false;
          }

          reduceOpacityOfAllCountriesLinks(0.05);
          reduceOpacityOfAllCountriesFlags(0.1);

          increaseLinksOpacityOfSelectedCountries(selectedCountries, 0.7);
          highlightSelectedLinkedCountries(selectedCountries, 0.45);
          let selectedCountriesComposed = [];
          selectedCountries.forEach(function (countryName) {
            selectedCountriesComposed.push({"country": countryName});
          });
          increaseFlagOpacityOfSelectedCountries(selectedCountriesComposed, 1);
        } else {
          let clickedCountryName = d.target.__data__.data.key;

          createIsolatedNode(clickedCountryName, iso3166_dict, countryNames);
          deleteChordDiagram(country2zone_dict[clickedCountryName]);
          moveCountryToIsolatedNodes(clickedCountryName);

          // draw new chord diagram
          drawChordDiagram(chordDiagramZone);
        }
      }

      function flagMouseOvered(d, event) {
        let overedCountryName = d.target.__data__.data.key;

        highlightLinksFromCountry(overedCountryName);
        highlightSelectedCountries();

        showTooltipCountry(overedCountryName, migrationsFlowsDetails[overedCountryName].in,
            migrationsFlowsDetails[overedCountryName].out, event);

        //showMigrationDetailsList(overedCountryName);
        showMigrationBarChartForCountry(overedCountryName);
      }

      function flagMouseOuted(d) {
        let overedCountryName = d.target.__data__.data.key;

        hideTooltipCountry();

        document.getElementById("details-list").innerHTML = "";

        if (!multipleSelectionActive)
          removeHighlightsLinksFromCountry(overedCountryName);

        if (showDifferenceColors) {
          // restore link colors
          setColorOffAllLinks("steelblue");
          reduceOpacityOfAllCountriesLinks(0.05);
        }
        //hideMigrationDetails();
      }
    },

    drawChordDiagramInternalLinks(chordDiagramZone, zoneCountries) {
      let normalizeClassName = this.normalizeClassName;
      let country2continent_dict = this.country2continent_dict;
      let chordDiagrams = this.chordDiagrams;
      let year = this.selectedEndYear; // document.getElementById("yearSlider").value;

      this.link[chordDiagramZone] = this.svg.select("#g-" + normalizeClassName(chordDiagramZone)).append("g").selectAll(".link");

      this.link[chordDiagramZone] = this.link[chordDiagramZone]
          .data(this.getLinks(zoneCountries.leaves()))
          .enter().append("path")
          .each(function (d) {
            d.source = d[0],
                d.target = d[d.length - 1];

            let countryNode = chordDiagrams[chordDiagramZone].nodes[d.source.data.name];

            Object.keys(countryNode.links).forEach(function (link) {
              if (link === d.target.data.name)
                d.weight = countryNode.links[link].quantity;
            });
          })
          .attr("class", function (d) {
            let from = d.source.data.name;
            let to = d.target.data.name;
            return "link link-internal link-internal-" + normalizeClassName(from) + " link-internal-" + normalizeClassName(to)
                + " link-" + normalizeClassName(from) + " link-" + normalizeClassName(to)
                + " link-from-" + normalizeClassName(from) + " link-to-" + normalizeClassName(to);
          })
          .attr("style", function (d) {
            let from = d.source.data.name;
            let to = d.target.data.name;

            let weight = 0;
            if (typeof (d.weight) === "number") {
              weight = d.weight;
            } else {
              if (viewOption === "immmigration") {
                weight = d.weight.out[year];
              } else if (viewOption === "emigration") {
                weight = d.weight.in[year];
              }
            }

            return "fill-opacity:" + 0.8 * (weight / migrationsFlowsDetails[from].max) + ";stroke-opacity:" + 0.8 * (weight / migrationsFlowsDetails[from].max) + ";z-index:-1;";
          })
          .attr("id", function (d) {
            let from = d.source.data.name;
            let to = d.target.data.name;

            return "path-" + normalizeClassName(from) + "-" + normalizeClassName(to);
          })
          .attr("d", this.line);
    },

    deleteChordDiagram(zone) {
      let normalizeClassName = this.normalizeClassName;
      this.removeElement("g-" + normalizeClassName(zone));
    },

    showMigrationDetailsList(countryName) {
      let findLinksOfCountry = this.findLinksOfCountry;

      let detailsListElement = document.getElementById("details-list");
      findLinksOfCountry(countryName).forEach(function (link) {
        let country = link.country;
        let quantity = link.quantity;

        if (quantity > 0) {
          detailsListElement.innerHTML +=
              "<li>" + country + ": " + quantity + "</li>";
        }
      });
    },

    /** **************************************
     ******* CHORD DIAGRAM OPERATIONS *******
     ****************************************/
    drawExternalLinksIsolatedNode(overedCountryName) {
      let yOffset = 300 - window.scrollY;

      let normalizeZoneName = this.normalizeZoneName;
      let normalizeClassName = this.normalizeClassName;
      let isolatedNode = this.isolatedNodes[overedCountryName];
      let externalLinks = this.externalLinks;

      Object.keys(externalLinks).forEach(function (d) {
        let fromCountryName = externalLinks[d].from;
        let toCountryName = externalLinks[d].to;

        var from = document.getElementById('node-' + normalizeClassName(fromCountryName));
        var to = document.getElementById('node-' + normalizeClassName(toCountryName));

        if (overedCountryName == fromCountryName && !(from == null || to == null)) {
          var fromLocation = from.getBoundingClientRect();
          var toLocation = to.getBoundingClientRect();

          var qCP = [(fromLocation.x + toLocation.x) / 2, (fromLocation.y + toLocation.y) / 2];
          var qPath = d3.path();
          qPath.moveTo(fromLocation.x, fromLocation.y - yOffset);
          qPath.quadraticCurveTo(qCP[0], qCP[1], toLocation.x, toLocation.y - yOffset);

          d3.select("#externalLinks")
              .append("path")
              .attr("id", "external-path-" + normalizeZoneName(fromCountryName) + "-" + normalizeZoneName(toCountryName))
              .attr("class", function () {
                return "link-path externalLink link external-path link-" + normalizeZoneName(fromCountryName) + " link-" + normalizeZoneName(toCountryName)
                    + " link-" + normalizeClassName(fromCountryName) + " link-" + normalizeClassName(toCountryName)
                    + " link-from-" + normalizeClassName(fromCountryName) + " link-to-" + normalizeClassName(toCountryName);
              })
              .attr("d", qPath)
              .attr("stroke", "black")
              .attr("style", "fill-opacity:.5;stroke-opacity:.3;z-index:-1;")
              .attr("fill", "none");
        }
      });

      Object.keys(isolatedNode.links).forEach(function (d) {
        let toCountryName = d;

        var from = document.getElementById('node-' + normalizeClassName(overedCountryName));
        var to = document.getElementById('node-' + normalizeClassName(toCountryName));

        if (!(from == null || to == null)) {
          var fromLocation = from.getBoundingClientRect();
          var toLocation = to.getBoundingClientRect();

          var qCP = [(fromLocation.x + toLocation.x) / 2, (fromLocation.y + toLocation.y) / 2];
          var qPath = d3.path();
          qPath.moveTo(fromLocation.x, fromLocation.y - yOffset);
          qPath.quadraticCurveTo(qCP[0], qCP[1], toLocation.x, toLocation.y - yOffset);

          d3.select("#externalLinks")
              .append("path")
              .attr("id", "external-path-" + normalizeClassName(overedCountryName) + "-" + normalizeClassName(toCountryName))
              .attr("class", function () {
                return "link-path link external-path link-" + normalizeClassName(overedCountryName) + " link-" + normalizeClassName(toCountryName)
                    + " link-from-" + normalizeClassName(overedCountryName) + " link-to-" + normalizeClassName(toCountryName);
              })
              .attr("d", qPath)
              .attr("stroke", "black")
              .attr("style", "fill-opacity:.5;stroke-opacity:.3;z-index:-1;")
              .attr("fill", "none");
        }
      });

    },
    drawExternalLinks(overedCountryName) {
      let normalizeZoneName = this.normalizeZoneName;
      let normalizeClassName = this.normalizeClassName;
      let externalLinks = this.externalLinks;
      let country2zone_dict = this.country2zone_dict;

      let zone = country2zone_dict[overedCountryName];

      let yOffset = 300 - window.scrollY;

      let i = 0;
      let triangles = {};
      for (i = 1; i <= 4; i++) {
        triangles[i] = document.getElementById("triangle-" + normalizeClassName(zone) + "-" + i);
      }

      Object.keys(externalLinks).forEach(function (d) {
        var from = document.getElementById('node-' + normalizeClassName(externalLinks[d].from));
        var to = document.getElementById('node-' + normalizeClassName(externalLinks[d].to));

        let fromCountryName = externalLinks[d].from;
        let toCountryName = externalLinks[d].to;

        if (overedCountryName == fromCountryName && !(from == null || to == null)) {
          var fromLocation = triangles[1].getBoundingClientRect();
          var toLocation = to.getBoundingClientRect();

          let min = calcDist(fromLocation, toLocation);
          for (i = 2; i <= 4; i++) {
            let dist = calcDist(triangles[i].getBoundingClientRect(), toLocation);
            if (dist < min) {
              fromLocation = triangles[i].getBoundingClientRect();
              min = dist;
            }
          }

          if (country2zone_dict[fromCountryName] !== country2zone_dict[toCountryName]) {
            var qCP = [(fromLocation.x + toLocation.x) / 2, (fromLocation.y + toLocation.y) / 2];
            var qPath = d3.path();
            qPath.moveTo(fromLocation.x, fromLocation.y - yOffset);
            qPath.quadraticCurveTo(qCP[0], qCP[1], toLocation.x, toLocation.y - yOffset);

            let strokeOpacity = multipleSelectionActive ? 0.05 : 0.2;

            d3.select("#externalLinks")
                .append("path")
                .attr("class", function () {
                  let from = fromCountryName;
                  let to = toCountryName;
                  return "link-path externalLink link external-path link-" + normalizeZoneName(from) + " link-" + normalizeZoneName(to)
                      + " link-from-" + normalizeZoneName(from) + " link-to-" + normalizeZoneName(to);
                })
                .attr("id", function () {
                  let from = fromCountryName;
                  let to = toCountryName;
                  return "external-path-" + normalizeZoneName(from) + "-" + normalizeZoneName(to);
                })
                .attr("d", qPath)
                .attr("stroke", "black")
                .attr("style", "fill-opacity:.5;stroke-opacity:" + strokeOpacity + ";z-index:-1;")
                .attr("fill", "none");
          }

        }

        function calcDist(elemBoundRect1, elemBoundRect2) {
          return Math.sqrt(Math.pow((elemBoundRect2.x - elemBoundRect1.x), 2) + Math.pow((elemBoundRect2.y - elemBoundRect1.y), 2));
        }

      });

    },
    deleteExternalLink(from, to) {
      let removeElement = this.removeElement;
      let normalizeClassName = this.normalizeClassName;

      removeElement("external-path-" + normalizeClassName(from) + "-" + normalizeClassName(to));
    },
    deleteExternalLinks(country) {

    },
    getCountryNames(diagram) {
      // collect all the nodes for each zone
      let chordDiagrams = diagram.chordDiagrams;

      let arr = [];

      Object.keys(chordDiagrams).forEach(function (zone) {
        let dict = chordDiagrams[zone].nodes;
        for (var key in dict) {
          arr.push(key);
        }
      });

      return arr;
    },
    getLinks(nodes) {
      var map = {}, imports = [];

      nodes.forEach(function (d) {
        map[d.data.name] = d;
      });

      nodes.forEach(function (d) {
        if (d.data.links) Object.keys(d.data.links).forEach(function (i) {
          if (map[i] !== undefined)
            imports.push(map[d.data.name].path(map[i]));
        });
      });

      return imports;
    },
    hierarchy(countries) {
      var map = {};

      function find(name, data) {
        var node = map[name];
        if (!node) {
          node = map[name] = data || {name: name, children: []};
          if (name.length) {
            node.parent = map[""];
            node.parent.children.push(node);
            node.key = name;
          }
        }
        return node;
      }

      find("", null);
      countries.forEach(function (d) {
        find(d[1].name, d[1]);
      });

      return d3.hierarchy(map[""]);
    },
    normalizeZoneName(zoneName) {
      return zoneName.replace(/\s+/g, '-');
    },
    normalizeClassName(className) {
      return className.replace(/\s+/g, '-');
    },
    chorDiagramMouseoveredGlob(chordDiagramZone) {
      overedChordDiagramZoneName = chordDiagramZone;
    },
    pushExternalLink(from, to, qty) {
      this.externalLinks.push({"from": from, "to": to, "quantity": qty});
    },
    highlightCountryFlag(countryName) {
      document.getElementById("node-" + this.normalizeClassName(countryName)).style.opacity = 1;
    },
    findLinksOfCountry(country) {
      let findInternalLinksOfCountry = this.findInternalLinksOfCountry;
      let findExternalLinksOfCountry = this.findExternalLinksOfCountry;
      let findLinksOfIsolatedCountry = this.findLinksOfIsolatedCountry;

      return findInternalLinksOfCountry(country)
          .concat(findExternalLinksOfCountry(country))
          .concat(findLinksOfIsolatedCountry(country));
    },
    findInternalLinksOfCountry(country) {
      let chordDiagrams = this.chordDiagrams;
      let country2continent_dict = this.country2continent_dict;

      let internalLinks = [];

      if (country in chordDiagrams[country2continent_dict[country]].nodes)
        Object.keys(chordDiagrams[country2continent_dict[country]].nodes[country].links).forEach(function (countryTo) {
          let link = chordDiagrams[country2continent_dict[country]].nodes[country].links[countryTo];
          internalLinks.push({"country": countryTo, "quantity": link.quantity});
        });

      return internalLinks;
    },
    findExternalLinksOfCountry(country) {
      let links = [];
      let externalLinks = this.externalLinks;
      let selectedYear = this.selectedEndYear; // document.getElementById("yearSlider").value;

      Object.keys(externalLinks).forEach(function (externalLink) {
        let quantity = 0;
        if (externalLinks[externalLink].from === country) {
          if (viewOption === "immigration") {
            if (Object.keys(externalLinks[externalLink].peso.in).length > 0)
              quantity = externalLinks[externalLink].peso.in[selectedYear];
          } else if (viewOption === "emigration") {
            if (Object.keys(externalLinks[externalLink].peso.out).length > 0)
              quantity = externalLinks[externalLink].peso.out[selectedYear];
          }
          links.push({
            "country": externalLinks[externalLink].to,
            "quantity": externalLinks[externalLink].peso.in[selectedYear]
          });
        }
      });
      return links;
    },
    findLinksOfIsolatedCountry(country) {
      let isolatedNodes = this.isolatedNodes;
      let links = [];

      if (isolatedNodes[country] !== undefined) {
        Object.keys(isolatedNodes[country].links).forEach(function (linkKey) {
          let countryTo = linkKey;
          let linkQuantity = isolatedNodes[country].links[linkKey].quantities;
          links.push({"country": countryTo, "quantity": linkQuantity});
        });
      }

      return links;
    },
    reduceOpacityOfAllCountriesLinks(opacity) {
      let cssSelector = "path.link";
      let elements = document.querySelectorAll(cssSelector);
      elements.forEach((el) => {
        el.style.opacity = opacity;
        el.setAttribute("stroke", "#aaa");
      });
    },
    setColorOffAllLinks(color) {
      let cssSelector = "path.link";
      let elements = document.querySelectorAll(cssSelector);
      elements.forEach((el) => {
        el.style.stroke = color;
      });
    },
    increaseLinksOpacityOfSelectedCountries(countries, opacity) {
      let normalizeClassName = this.normalizeClassName;
      countries.forEach(function (country) {
        let cssSelector = ".link-from-" + normalizeClassName(country);
        let elements = document.querySelectorAll(cssSelector);
        elements.forEach((el) => {
          el.style.opacity = opacity;
        })
      });
    },
    drawExternalLinksOfSelectedCountries(selectedCountries) {
      let drawExternalLinks = this.drawExternalLinks;
      selectedCountries.forEach(function (countryName) {
        drawExternalLinks(countryName);
      });
    },
    reduceOpacityOfAllCountriesFlags(opacity) {
      let cssSelector = ".flag";
      let elements = document.querySelectorAll(cssSelector);
      elements.forEach((el) => {
        el.style.opacity = opacity
      });
    },
    increaseFlagOpacityOfSelectedCountries(countries, opacity) {
      let normalizeClassName = this.normalizeClassName;
      countries.forEach(function (country) {

        if (country.country !== undefined) {
          let cssSelector = "#node-" + normalizeClassName(country.country);
          let elements = document.querySelectorAll(cssSelector);
          elements.forEach((el) => {
            el.style.opacity = opacity
          });
        }
      });
    },
    moveCountryToIsolatedNodes(country) {
      let country2zone_dict = this.country2zone_dict;
      let chordDiagrams = this.chordDiagrams;
      let externalLinks = this.externalLinks;
      let isolatedNodes = this.isolatedNodes;
      let clickedCountryName = country;
      let normalizeExternalLinkKey = this.normalizeExternalLinkKey;

      let zoneCountriesNodes = chordDiagrams[country2zone_dict[clickedCountryName]]["nodes"];

      isolatedNodes[clickedCountryName] = zoneCountriesNodes[clickedCountryName];   // should i create a copy
      delete chordDiagrams[country2zone_dict[clickedCountryName]]["nodes"][clickedCountryName];
      country2zone_dict[clickedCountryName] = ""; // node belongs to no zone

      // have to create external links
      Object.keys(zoneCountriesNodes).forEach(function (countryNameKey) { // for each node of the original zone/diagram
        // i have to check if the current country has the link to the selected country that will go to isolated nodes
        let zoneNode = zoneCountriesNodes[countryNameKey];
        let zoneNodeLinks = zoneNode.links;
        let internalLink = zoneNodeLinks[clickedCountryName];

        // devo creare due external links (uno from e l'altro to)
        externalLinks[normalizeExternalLinkKey(clickedCountryName, country)]
            = {"from": clickedCountryName, "to": countryNameKey, "quantity": internalLink};

        externalLinks[normalizeExternalLinkKey(clickedCountryName, country)]
            = {"from": countryNameKey, "to": clickedCountryName, "quantity": internalLink};

        // delete internal link
        delete zoneCountriesNodes[countryNameKey].links[clickedCountryName];
      });


    },
    highlightLinksFromCountry(country) {
      let overedCountryName = country;
      let drawExternalLinksIsolatedNode = this.drawExternalLinksIsolatedNode;
      let drawExternalLinks = this.drawExternalLinks;
      let normalizeClassName = this.normalizeClassName;
      let externalLinks = this.externalLinks;
      let countryNames = this.countryNames;
      let country2zone_dict = this.country2zone_dict;
      let findLinksOfCountry = this.findLinksOfCountry;
      let reduceOpacityOfAllCountriesLinks = this.reduceOpacityOfAllCountriesLinks;
      let reduceOpacityOfAllCountriesFlags = this.reduceOpacityOfAllCountriesFlags;
      let increaseLinksOpacityOfSelectedCountries = this.increaseLinksOpacityOfSelectedCountries;
      let increaseFlagOpacityOfSelectedCountries = this.increaseFlagOpacityOfSelectedCountries;
      let colorLinksFromCountry = this.colorLinksFromCountry;

      if (country2zone_dict[country] === "")
        drawExternalLinksIsolatedNode(overedCountryName);
      else
        drawExternalLinks(overedCountryName);

      reduceOpacityOfAllCountriesLinks(0.02);
      reduceOpacityOfAllCountriesFlags(0.1);

      if (!showDifferenceColors) {
        increaseLinksOpacityOfSelectedCountries([country], 0.7);
      } else {
        colorLinksFromCountry(country);
      }

      increaseFlagOpacityOfSelectedCountries([{"country": country}], 1);
      increaseFlagOpacityOfSelectedCountries(findLinksOfCountry(country), 0.6);
    },
    removeHighlightsLinksFromCountry(country) {
      let overedCountryName = country;
      let normalizeClassName = this.normalizeClassName;

      let elements = document.getElementsByClassName("link-path");
      while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
      }

      let cssSelector = "path.link:not(.link-" + normalizeClassName(overedCountryName) + ")";
      elements = document.querySelectorAll(cssSelector);

      elements.forEach((el) => {
        el.style.opacity = '1'
      })

      cssSelector = ".flag";
      elements = document.querySelectorAll(cssSelector);

      elements.forEach((el) => {
        el.style.opacity = '1'
      });
    },
    colorLinksFromCountry(countryName) {
      // for each link of the country I should color each edge
      let year = this.selectedEndYear; // document.getElementById("yearSlider").value;
      let chordDiagrams = this.chordDiagrams;
      let country2zone_dict = this.country2zone_dict;
      let normalizeClassName = this.normalizeClassName;

      let countryZone = country2zone_dict[countryName];

      let internalLinks = chordDiagrams[countryZone].nodes[countryName].links;

      // internal links
      Object.keys(internalLinks).forEach(function (link) {
        let linkCountryName = link;
        let linkCountry = internalLinks[link];
        let idSelector = "path-" + normalizeClassName(countryName) + "-" + normalizeClassName(linkCountryName);
        let el = document.getElementById(idSelector);

        let migrationsIn = linkCountry.in[year];
        let migrationsOut = linkCountry.out[year];

        let balance = migrationsIn - migrationsOut;
        if (balance > 0) {
          el.style.stroke = "lightblue";
        } else {
          el.style.stroke = "red";
        }
        el.style.strokeOpacity = 0.8;
        el.style.opacity = 0.8;
      });

      // external links
      this.drawExternalLinksOfSelectedCountries([countryName]);
      this.colorLinksOfExternalCountry(countryName);
    },
    colorLinksOfExternalCountry(country) {
      let year = this.selectedEndYear; // document.getElementById("yearSlider").value;

      let normalizeClassName = this.normalizeClassName;
      let externalLinks = this.externalLinks;

      Object.keys(externalLinks).forEach(function (d) {
        let fromCountryName = externalLinks[d].from;
        let toCountryName = externalLinks[d].to;
        let peso = externalLinks[d].peso;
        let migrationsIn = peso.in[year];
        let migrationsOut = peso.out[year];

        let idSelector = "external-path-" + normalizeClassName(fromCountryName) + "-" + normalizeClassName(toCountryName);
        let el = document.getElementById(idSelector);

        if (el !== null) {
          migrationsIn === undefined ? 0 : migrationsIn;
          migrationsOut === undefined ? 0 : migrationsOut;

          let balance = migrationsIn - migrationsOut;

          if (balance > 0) {
            el.style.stroke = "green";
          } else {
            el.style.stroke = "red";
          }
          el.style.strokeOpacity = 0.8;
          el.style.opacity = 0.8;
        }

      });
    },
    moveCountryToZone(countryName, zoneTo) {
      let chordDiagrams = this.chordDiagrams;
      let isolatedNodes = this.isolatedNodes;
      let externalLinks = this.externalLinks;
      let normalizeExternalLinkKey = this.normalizeExternalLinkKey;
      let country2continent_dict = this.country2continent_dict;
      let deleteExternalLink = this.deleteExternalLink;
      let deleteChordDiagram = this.deleteChordDiagram;
      let removeElement = this.removeElement;
      let normalizeClassName = this.normalizeClassName;
      let drawChordDiagram = this.drawChordDiagram;
      let year = this.selectedEndYear; // document.getElementById("yearSlider").value;

      let originalZone = country2continent_dict[countryName];

      // move node from isolated nodes to chordLink diagram
      chordDiagrams[zoneTo]["nodes"][countryName] = isolatedNodes[countryName];

      country2continent_dict[countryName] = zoneTo;

      // rimuovi tutti gli internal link: devono diventare external
      let draggedCountryInternalLinks = chordDiagrams[zoneTo]["nodes"][countryName].links;
      Object.keys(draggedCountryInternalLinks).forEach(function (internalLinkKey) {
        let from = countryName;
        let to = internalLinkKey;
        let quantity = 0;

        if (viewOption == "immigration") {
          quantity = draggedCountryInternalLinks[to].in[year];
        } else if (viewOption == "emigration") {
          quantity = draggedCountryInternalLinks[to].out[year];
        }

        let peso = {"in": {}, "out": {}};
        externalLinks[normalizeExternalLinkKey(from, to)] = {
          "from": from,
          "to": to,
          "peso": peso,
          "quantity": quantity
        };

        // specular migration
        if (viewOption == "immigration") {
          quantity = draggedCountryInternalLinks[to].out[year];
        } else if (viewOption == "emigration") {
          quantity = draggedCountryInternalLinks[to].in[year];
        }

        externalLinks[normalizeExternalLinkKey(to, from)] = {
          "from": to,
          "to": from,
          "peso": peso,
          "quantity": quantity
        };

      });
      chordDiagrams[zoneTo].nodes[countryName].links = {};

      // work on the countries of the same zone
      // delete the country from the original zone links form other countries
      Object.keys(chordDiagrams[originalZone].nodes).forEach(function (countryName) {
        let countryNode = chordDiagrams[originalZone].nodes[countryName];

        let countryNodeLinks = countryNode.links;
        Object.keys(countryNodeLinks).forEach(function (linkKey) {
          if (linkKey === countryName)
            delete countryNodeLinks[linkKey];
        });
      });

      // external links related to the isolated node must be deleted, but only those related to same region
      Object.keys(externalLinks).forEach(function (externalLinkKey) {
        let from = externalLinks[externalLinkKey].from;
        let fromRegionName = country2continent_dict[from];
        let to = externalLinks[externalLinkKey].to;
        let toRegionName = country2continent_dict[to];
        let quantity = externalLinks[externalLinkKey].peso;

        // move external link to internal link
        // if the external link is now from and to the same region
        if (from === countryName && zoneTo == toRegionName) {
          chordDiagrams[zoneTo].nodes[from].links[to] =
              {"in": quantity.in, "out": quantity.out, "quantity": quantity};
          deleteExternalLink(from, to);
          delete externalLinks[normalizeExternalLinkKey(from, to)];
        }
      });

      delete isolatedNodes[countryName];

      deleteChordDiagram(zoneTo);
      removeElement("node-" + normalizeClassName(countryName));

      drawChordDiagram(zoneTo);

    },
    showSidebar() {
      document.getElementById("sidebar").style.display = "block";
      document.getElementById("sidebar").style.visibility = "visible";
    },
    closeSidebar() {
      document.getElementById("sidebar").style.display = "none";
      document.getElementById("sidebar").style.visibility = "hidden";
    },
    showTooltipCountry(countryName, migrationsIn, migrationsOut, event) {
      this.tooltip.style("opacity", 1);

      let tooltipX = this.getFlagLocation(countryName).x + 5;
      let tooltipY = this.getFlagLocation(countryName).y + window.scrollY - 200;

      let regionX = this.getRegionCenter(this.country2zone_dict[countryName]).x;
      let regionY = this.getRegionCenter(this.country2zone_dict[countryName]).y;

      let deltaX = regionX - tooltipX;
      let deltaY = regionY - tooltipY;

      if(deltaX > 0) {
        tooltipX -= 150;
      }

      if(deltaY < 0) {
        tooltipY += 50;
      }

      console.log([deltaX,deltaY]);

      this.tooltip
          .html("<h4>" + countryName + "</h4>" + "In: " + migrationsIn + "<br>" + "Out: " + migrationsOut)
          .style("left", tooltipX + "px")
          .style("top", tooltipY + "px");
    },
    hideTooltipCountry() {
      this.tooltip.style("opacity", 0);
    },
    getFlagLocation(countryName) {
      let normalizeClassName = this.normalizeClassName;

      var flagElement = document.getElementById('node-' + normalizeClassName(countryName));
      return flagElement.getBoundingClientRect();
    },
    getCircleLocation(zoneName) {
      let normalizeClassName = this.normalizeClassName;

      var circleElement = document.getElementById('circle-' + normalizeClassName(zoneName));
      return circleElement.getBoundingClientRect();
    },
    getDiagramCentreLocation(zoneName) {
      let normalizeClassName = this.normalizeClassName;

      var diagramElement = document.getElementById('g-' + normalizeClassName(zoneName)).getBoundingClientRect();
      let width = diagramElement.width;
      let height = diagramElement.height;
      let x = diagramElement.x;
      let y = diagramElement.y;

      return {"x": x + width / 2, "y": y + height / 2};
    },
    removeElement(id) {
      let elem = document.getElementById(id);
      return elem.parentNode.removeChild(elem);
    },
    mouseOverWithCtrl() {
    },
    getIsolatedNodes() {
      return this.isolatedNodes;
    },
    overlap(elem1, elem2) {
      let elem1BR = elem1.getBoundingClientRect();
      let elem2BR = elem2.getBoundingClientRect();
      return this.overlapCircleFlag(elem1BR, elem2BR);
    },
    overlapCircleFlag(circle, flag) {
      let lineSize = 340;
      if (flag.x >= circle.x && flag.x <= circle.x + circle.width
          && flag.y >= circle.y && flag.y <= circle.y + circle.height) {
        return true;
      }
      return false;
    },
    insertCountryInRegion(node) {
      
    },
    getRegionCenter(zoneName) {
      let rect = document.getElementById("g-" + this.normalizeClassName(zoneName)).getBoundingClientRect();
      let boundLen = 200;
      let rectX = rect.x;
      let rectY = rect.y + window.scrollY;

      return {"x": rectX + boundLen/2, "y": rectY + boundLen/2};
    },
    hideMigrationDetails() {
      document.getElementById("sidebarCountryDetailsBoxPlot").innerHTML = "";
    },
    showMigrationBarChartForCountry(countryName) {
      var margin = {top: 20, right: 30, bottom: 40, left: 90},
          width = 460 - margin.left - margin.right,
          height = 600;

      let findLinksOfCountry = this.findLinksOfCountry;
      let showTooltipCountry = this.showTooltipCountry;
      let hideTooltipCountry = this.hideTooltipCountry;

      let dataDetails = [];
      let qtymax = 0;
      findLinksOfCountry(countryName).forEach(function (link) {
        let country = link.country;
        let quantity = link.quantity;
        if (quantity > qtymax) {
          qtymax = quantity;
        }
        if (quantity > 1) {
          dataDetails.push({"country": country, "quantity": quantity});
        }
      });

      document.getElementById("sidebarCountryDetailsBoxPlot").innerHTML = "";
      let detailsSvg = d3.select("#sidebarCountryDetailsBoxPlot");

      var x = d3.scaleLinear()
          .domain([0, qtymax])
          .range([0, width]);
      detailsSvg.append("g")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(x))
          .selectAll("text")
          .attr("transform", "translate(-10,0)rotate(-45)")
          .style("text-anchor", "end");

      // Y axis
      var y = d3.scaleBand()
          .range([0, height])
          .domain(dataDetails.map(function (d) {
            return d.country;
          }))
          .padding(.1);
      detailsSvg.append("g")
          .call(d3.axisLeft(y));

      detailsSvg.selectAll("rect")
          .data(dataDetails)
          .enter()
          .append("rect")
          .attr("x", x(0))
          .attr("y", function (d) {
            return y(d.country);
          })
          .attr("width", function (d) {
            return x(d.quantity);
          })
          .attr("height", y.bandwidth())
          .attr("fill", "#69b3a2")
          .on("mouseover", function (d, event) {
            let country_ = d.toElement.__data__.country;
            showTooltipCountry(country_, migrationsFlowsDetails[country_].in,
                migrationsFlowsDetails[country_].out, event);
          })
          .on("mouseout", function () {
            hideTooltipCountry();
          })
      ;

    },
    highlightSelectedCountries() {
      let highlightCountryFlag = this.highlightCountryFlag;
      let highlightLinksFromCountry = this.highlightLinksFromCountry;

      selectedCountries.forEach(function (selectedCountry) {
        //highlightLinksFromCountry(selectedCountry);
        highlightCountryFlag(selectedCountry);
      });
    },
    highlightSelectedLinkedCountries(countriesList, opacity) {
      let findLinksOfCountry = this.findLinksOfCountry;
      let normalizeClassName = this.normalizeClassName;

      countriesList.forEach(function (countryName) {
        let countryLinks = findLinksOfCountry(countryName);

        countryLinks.forEach(function (link) {
          let flagElement = document.getElementById("node-" + normalizeClassName(link.country));
          flagElement.style.opacity = opacity;
        });
      });
    }
  }
}
</script>
  