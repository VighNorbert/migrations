<template>
  <div class="sliderDiv">
    <input type="range" min="1960" max="2010" step="10" v-model="sliderValue" id="yearSlider" @change="sliderChange"> 
  </div>
    <div class="map-canvas">
    </div>
  </template>

  <!-- TODO
    1d
  - option to show colors for the flows: red=more immigrants than emigrants, blue viceversa
    3d
  - two different views for immigration and emigration
    show on the popup how flows are distributed among countries
    
  - filter migrations by amount
  - (animations) 

  -->
  
  <script>
  import * as d3 from 'd3';

  var overedChordDiagramZoneName = "";
  let isChordDiagramOvered = false;
  var selectedCountries = [];
  let multipleSelectionActive = false;
  let migrationsFlowsDetails = {};
  let data = {};

  export default {
    name: 'HybridGraph',
    async mounted() {
      let dataAsync = await this.loadData();
      data = dataAsync;
      let summData = this.summarizeData(data,0,1970,0);
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
        let years = [1960,1970,1980,1990,2000,2010];

        let code2country_dict = {};
        countries.forEach(function(country) {
          code2country_dict[country.code] = country.name;
        });

        let zones = await d3.json("../../data/config/zones.json");

        let migrations = await d3.json("../../data/migration.json");
        
        let diagramDataStructure = {};
        diagramDataStructure.chordDiagrams = {};
        diagramDataStructure.externalLinks = [];
        diagramDataStructure.isolatedNodes = {};

        // now I have to build the skeleton data structure
        let country2continent = await d3.json("../../data/config/country_continent_mapping.json");
        let country2continent_dict = {};
        country2continent.mapping.forEach(function(c2c) {
          let country = c2c.country;
          let continent = c2c.continent;

          country2continent_dict[country] = continent;

          if(!(continent in diagramDataStructure.chordDiagrams)) {
            diagramDataStructure.chordDiagrams[continent] = {};
            diagramDataStructure.chordDiagrams[continent]["x"] = zones[continent]["x"];
            diagramDataStructure.chordDiagrams[continent]["y"] = zones[continent]["y"];
            diagramDataStructure.chordDiagrams[continent]["radius"] = zones[continent]["radius"];
            diagramDataStructure.chordDiagrams[continent]["nodes"] = {};
          }

          diagramDataStructure.chordDiagrams[continent]["nodes"][country] = {};
          diagramDataStructure.chordDiagrams[continent]["nodes"][country]["name"] = country;
          diagramDataStructure.chordDiagrams[continent]["nodes"][country]["links"] = [];
        });

        this.country2continent_dict = country2continent_dict;

        migrations.forEach(function(migration, index) {
          migrations[index].source = code2country_dict[migration.source];
          migrations[index].target = code2country_dict[migration.target];

          let sourceCountry = migrations[index].source;
          let targetCountry = migrations[index].target;
          let quantities = migrations[index].total;

          let flowQuantities = {};
          quantities.forEach(function(quantity,index) {
            flowQuantities[years[index]] = quantity;
          });

          if(country2continent_dict[sourceCountry] !== undefined && country2continent_dict[targetCountry] !== undefined) {
            if(country2continent_dict[sourceCountry] === country2continent_dict[targetCountry]) {   
              // insert as internal migration         
              diagramDataStructure.chordDiagrams[country2continent_dict[sourceCountry]]["nodes"][sourceCountry]["links"].push(
                {"country":targetCountry, "quantity":flowQuantities}
              );
            } else {
              // insert as external migration
              diagramDataStructure["externalLinks"].push({"from":sourceCountry,"to":targetCountry,"weight":flowQuantities});
            }
          }
        });

        return diagramDataStructure;
      },
      sliderChange() {
        let year = document.getElementById("yearSlider").value;
        migrationsFlowsDetails = {};

        let summData = this.summarizeData(data,0,year,0);

        //let diagram = await this.loadDiagram();
        let diagram = summData;
        let iso3166 = this.iso3166;

        this.removeElement("chordlink");

        this.HybridGraph(diagram, iso3166);
      },
      summarizeData(fullDiagramData,fromYear,toYear,minFilter) {
        let fullDiagramDataCopy = {};
        fullDiagramDataCopy = JSON.parse(JSON.stringify(fullDiagramData));

        // work on internal migrations
        Object.keys(fullDiagramDataCopy.chordDiagrams).forEach(function(zone) {
          let diagramZone = fullDiagramDataCopy.chordDiagrams[zone];

          Object.keys(diagramZone.nodes).forEach(function(diagramNodeName) {
            let diagramNode = diagramZone.nodes[diagramNodeName];

            let nodeLinks = diagramNode.links;

            let quantitySum = 0;
            nodeLinks.forEach(function(nodeLink) {
              let nodeLinkCountry = nodeLink.country;
              let nodeLinkQuantities = nodeLink.quantity;

              Object.keys(nodeLinkQuantities).forEach(function(y) {
                if(y >= fromYear && y <= toYear) {
                  quantitySum += nodeLinkQuantities[y];
                }
              });

              nodeLink.quantity = quantitySum;

              if(!(diagramNodeName in migrationsFlowsDetails)) {
                migrationsFlowsDetails[diagramNodeName] = {"in":0,"out":0};
              }

              migrationsFlowsDetails[diagramNodeName].out = quantitySum;

              if(!(nodeLinkCountry in migrationsFlowsDetails)) {
                migrationsFlowsDetails[nodeLinkCountry] = {"in":0,"out":0};
              }

              migrationsFlowsDetails[nodeLinkCountry].in = quantitySum;
            });

          });
        });

        // work on external migrations
        fullDiagramDataCopy.externalLinks.forEach(function(externalLink,index) {
          let from = externalLink.from;
          let to = externalLink.to;
          let weights = externalLink.weight;

          let sumWeights = 0;
          Object.keys(weights).forEach(function(y) {
            if(y >= fromYear && y <= toYear) {
              sumWeights += weights[y];
            }
          });

          fullDiagramDataCopy.externalLinks[index].weight = sumWeights;    
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
          .attr("transform", "translate(" + radius + "," + radius + ")");

        document.querySelector(".map-canvas").appendChild(this.svg.node().parentNode);

        d3.select("#chordlink").append("g").attr("id","externalLinks")
          .attr("transform", "translate(-200,-177)");

        
        this.tooltip = d3.select(".map-canvas")
          .append("div")
          .style("opacity", 0)
          .attr("class", "tooltip")
          .style("background-color", "white")
          .style("border", "solid")
          .style("border-width", "2px")
          .style("border-radius", "5px")
          .style("padding", "5px")
          .style("position","absolute")
          ;

        this.line = d3.radialLine()
          .curve(d3.curveBundle.beta(0.85))
          .radius(function(d) { if(d!=null) return d.y; return 0; })
          .angle(function(d) {
            if(d!=null)
              return d.x / 180 * Math.PI; 
            return 0;
          });
        
        this.drawChordDiagrams(diagram, iso3166);
      },
      drawChordDiagrams(diagram, iso3166) {
        
        this.link = {};
        this.node = {};

        let diagramCopy = {};
        Object.assign(diagramCopy,diagram);

        this.chordDiagrams = diagramCopy.chordDiagrams;
        this.externalLinks = diagramCopy.externalLinks;
        this.isolatedNodes = diagramCopy.isolatedNodes;
        
        let drawChordDiagram = this.drawChordDiagram;
        
        let chordDiagrams = this.chordDiagrams;

        // get all the countries names
        this.countryNames = this.getCountryNames(diagram);
        //let countryNamesSet = new Set(countryNames);

        // build iso3166 dict
        let iso3166_dict = {};
        iso3166.mappings.forEach(function(country) {
          iso3166_dict[country["Name"]] = country["Code"];
        });

        this.iso3166_dict = iso3166_dict;
        
        let country2zone_dict = {};
        this.country2zone_dict = country2zone_dict;
        
        Object.keys(chordDiagrams).forEach(function(chordDiagramZone) {
          drawChordDiagram(chordDiagramZone);
        });

      },

      // draws the triangles around the zone
      drawGuidePoints(zoneName) {

        let normalizeZoneName = this.normalizeZoneName;

        let radius = 150;

        let configurations = [{"x":-radius,"y":-radius,"rotation":-45},{"x":radius,"y":-radius,"rotation":45},
          {"x":radius,"y":radius,"rotation":135},{"x":-radius,"y":radius,"rotation":-135}];

        
        let i = 1;
        configurations.forEach(function(conf) {
          let x = conf.x;
          let y = conf.y;
          let angle = conf.rotation;

          var sym = d3.symbol().type(d3.symbolTriangle).size(100);
          d3.select("#g-" + normalizeZoneName(zoneName))
            .append("path")
            .attr("d", sym)
            .attr("id", "triangle-"+normalizeZoneName(zoneName)+"-"+i)
            .attr("class", "triangle")
            .attr("fill", "lightblue")
            .attr("transform", "translate(" + x + ", " + y + ")rotate(" + angle + ")");
            
          i++;
        });       

      },
      createIsolatedNode(countryName,iso3166_dict) {
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
        let highlightSelectedCountries = this.highlightSelectedCountries;

        // delete old node
        removeElement("node-" + normalizeClassName(countryName));

        d3.select("svg#chordlink")
          .append("g")
          .attr("id","g-isolated-node-" + normalizeClassName(countryName))
          .attr("class", "g-isolated-node")
          ;
        
        d3.select("#g-isolated-node-" + normalizeClassName(countryName))
          .append("image")
          .attr("class", "g-isolated-node")
          .attr("href", function() {
              return require('@/assets/img/w20/' + iso3166_dict[countryName].toString().toLowerCase() + '.png');
            })
          .attr("data-country", countryName)
          .attr("id", "node-"+normalizeClassName(countryName))
          .on("mouseover", isolatedNodeMouseovered)
          .on("mouseout", isolatedNodeMouseouted)
          .call(d3.drag()
            .on('start', isolatedNodeDragStart)
            .on('drag', isolatedNodeDragging)
            .on('end', isolatedNodeDragEnd)
          )
          ;

          function isolatedNodeDragStart(){
              d3.select(this).style("stroke", "");
          }
            
          function isolatedNodeDragging(event) {
              var xCoor = event.x;
              var yCoor = event.y;

              d3.select(this).attr("transform", "translate("+ xCoor + "," + yCoor +")");
          }
          
          function isolatedNodeDragEnd() {
            // move node from isolated nodes to chordLink diagram
            chordDiagrams[overedChordDiagramZoneName]["nodes"][countryName] = isolatedNodes[countryName];
            
            externalLinks.forEach(function(externalLink) {
              let from = externalLink.from;
              let to = externalLink.to;
              let quantity = externalLink.quantity;
              
              if(from===countryName) {
                chordDiagrams[overedChordDiagramZoneName]["nodes"][countryName].links
                  .push({"country":to,"quantity":quantity});
                  deleteExternalLink(from,to);
              }
            });

            country2continent_dict[countryName] = overedChordDiagramZoneName;
            
            externalLinks = externalLinks.filter(externalLink => externalLink.from!==countryName);

            isolatedNodes[countryName].links.forEach(function(link) {
              pushExternalLink(countryName,link.country,link.quantity);
            });

            delete isolatedNodes[countryName];

            deleteChordDiagram(overedChordDiagramZoneName);
            removeElement("node-"+normalizeClassName(countryName));

            drawChordDiagram(overedChordDiagramZoneName);
          
          }

          function isolatedNodeMouseovered(d) {
            let overedCountryName = d.target.dataset.country;
            highlightLinksFromCountry(overedCountryName);
          }

          function isolatedNodeMouseouted(d) {
            let overedCountryName = d.target.dataset.country;
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
          if (containsKey(dict,key)) {
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
              .attr("transform", function() {
                return "translate(" + chordDiagrams[chordDiagramZone].x + "," + chordDiagrams[chordDiagramZone].y + ")";
              })
              .call(d3.drag()
                .on('start', chordDiagramDragStart)
                .on('drag', chordDiagramDragging)
                .on('end', chordDiagramDragEnd)
              )
              .on("mouseover", chorDiagramMouseovered)
              .on("mouseout", chorDiagramMouseouted)
              .selectAll(".node");
            
            /** CHORD DIAGRAM EVENTS  */
            function chorDiagramMouseovered(e) {
              chorDiagramMouseoveredGlob(chordDiagramZone);

              isChordDiagramOvered = true;
            }

            function chorDiagramMouseouted(e) {
              isChordDiagramOvered = false;
            }
            function chordDiagramDragStart(){
              d3.select(this)
                .style("stroke", "")
            }            
            function chordDiagramDragging(event){
                var xCoor = event.x;
                var yCoor = event.y;                

                d3.select(this)
                  .attr("transform", "translate("+ xCoor + "," + yCoor +")");
            }            
            function chordDiagramDragEnd() {
            }

            // append a rect to g for letting drag options
            d3.select("#g-" + this.normalizeClassName(chordDiagramZone)).append("rect")
            .attr("width", "400px")
            .attr("height", "400px")
            .attr("transform","translate(-200,-200)")
            .style('opacity', 0);

            // append a circle to g for letting drag options
            d3.select("#g-" + this.normalizeClassName(chordDiagramZone)).append("circle")
            .attr("r", "170")
            .attr("fill","white")
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

        /** Draw all the flags */
        this.node[chordDiagramZone] = this.node[chordDiagramZone]
            .data(zoneCountries.leaves())
            .enter().append("image")
              .attr("class", function() {
                return "node flag chord-diagram-text node-" + normalizeClassName(chordDiagramZone);
              })
              .attr("data-country", function(d) {
                return d.data.key;
              })
              .attr("id", function(d) {
                return "node-" + normalizeClassName(d.data.key);
              })
              .attr("transform", function(d) {
                return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 10) + ",0)";// + (d.x < 180 ? "" : "rotate(180)"); 
              })
              .attr("href", function(d) {
                if(d.data.key !== undefined && iso3166_dict[d.data.key] !== undefined)
                  return require('@/assets/img/w20/' + iso3166_dict[d.data.key].toString().toLowerCase() + '.png');
                else
                  return "";
              })
              .on("mouseover", flagMouseOvered)
              .on("mouseout", flagMouseOuted)
              .on("click", flagMouseClick)
              .on("contextmenu", function (d, i) {
                let countryName = d.target.__data__.data.name;

                // if country in set then remove it, otherwise insert it
                let elementIndex = selectedCountries.indexOf(countryName);
                if(elementIndex == -1) {
                  selectedCountries.push(countryName);
                  multipleSelectionActive = true;
                } else {
                  selectedCountries.splice(elementIndex,1);
                  if(selectedCountries.length == 0)
                    multipleSelectionActive = false;
                }

                reduceOpacityOfAllCountriesLinks(0.05);
                reduceOpacityOfAllCountriesFlags(0.1);

                increaseLinksOpacityOfSelectedCountries(selectedCountries,0.7);
                increaseFlagOpacityOfSelectedCountries(selectedCountries,1);

              });

              /** CHORD DIAGRAMS FLAGS EVENTS */
              function flagMouseClick(d) {
                let clickedCountryName = d.target.__data__.data.key;
                
                createIsolatedNode(clickedCountryName,iso3166_dict,countryNames);  

                deleteChordDiagram(country2zone_dict[clickedCountryName]);     
                
                moveCountryToIsolatedNodes(clickedCountryName);
                
                // draw new chord diagram
                drawChordDiagram(chordDiagramZone);
              }

              function flagMouseOvered(d,event) {
                let overedCountryName = d.target.__data__.data.key;
                
                highlightLinksFromCountry(overedCountryName);   
                highlightSelectedCountries();

                // get migrations out from country

                // get migrations in to country

                showTooltipCountry(overedCountryName,migrationsFlowsDetails[overedCountryName].in,
                                  migrationsFlowsDetails[overedCountryName].out,event);
              }

              function flagMouseOuted(d) {
                let overedCountryName = d.target.__data__.data.key;
                
                hideTooltipCountry();

                if(!multipleSelectionActive)
                  removeHighlightsLinksFromCountry(overedCountryName);
              }
      },

      drawChordDiagramInternalLinks(chordDiagramZone, zoneCountries) {
              let normalizeClassName = this.normalizeClassName;

              this.link[chordDiagramZone] = this.svg.select("#g-" + normalizeClassName(chordDiagramZone)).append("g").selectAll(".link");
          
              this.link[chordDiagramZone] = this.link[chordDiagramZone]
                .data(this.getLinks(zoneCountries.leaves()))
                .enter().append("path")
                  .each(function(d) {
                    d.source = d[0],
                    d.target = d[d.length - 1];
                  })
                  .attr("class", function(d) {
                    let from = d.source.data.name;
                    let to = d.target.data.name;
                    return "link link-internal link-internal-" + normalizeClassName(from) + " link-internal-" + normalizeClassName(to)
                            + " link-" + normalizeClassName(from) + " link-" + normalizeClassName(to)
                            + " link-from-" + normalizeClassName(from) + " link-to-" + normalizeClassName(to);
                  })
                  .attr("d", this.line);
      },

      deleteChordDiagram(zone) {
        let normalizeClassName = this.normalizeClassName;
        this.removeElement("g-" + normalizeClassName(zone));
      },

      /** **************************************
       ******* CHORD DIAGRAM OPERATIONS *******
       ****************************************/
      drawExternalLinksIsolatedNode(overedCountryName) {
        let yOffset = 0;

        let normalizeZoneName = this.normalizeZoneName;
        let normalizeClassName = this.normalizeClassName;
        let isolatedNode = this.isolatedNodes[overedCountryName];
        let externalLinks = this.externalLinks;

        externalLinks.forEach(function(d) {
          var from = document.getElementById('node-' + normalizeClassName(d.from));
          var to = document.getElementById('node-' + normalizeClassName(d.to));

          if(overedCountryName==d.from && !(from == null || to == null)) {
            var fromLocation = from.getBoundingClientRect();
            var toLocation = to.getBoundingClientRect();

            var qCP = [(fromLocation.x + toLocation.x) /2, (fromLocation.y + toLocation.y) / 2];
            var qPath = d3.path();
            qPath.moveTo(fromLocation.x, fromLocation.y);
            qPath.quadraticCurveTo(qCP[0],qCP[1], toLocation.x, toLocation.y-yOffset);

            d3.select("#externalLinks")
              .append("path")
              .attr("id", "external-path-" + normalizeZoneName(d.from) + "-" + normalizeZoneName(d.to))
              .attr("class",function() {
                let from = d.from;
                let to = d.to;
                return "link-path link external-path link-"+normalizeZoneName(from)+" link-"+normalizeZoneName(to);
              })
              .attr("d", qPath)
              .attr("stroke", "black")
              .attr("style", "fill-opacity:.5;stroke-opacity:.3;z-index:-1;")
              .attr("fill", "none");
          }
        });

        isolatedNode.links.forEach(function(d) {
          var from = document.getElementById('node-' + normalizeClassName(overedCountryName));
          var to = document.getElementById('node-' + normalizeClassName(d.country));
          
          if(!(from == null || to == null)) {
            var fromLocation = from.getBoundingClientRect();
            var toLocation = to.getBoundingClientRect();

            var qCP = [(fromLocation.x + toLocation.x) /2, (fromLocation.y + toLocation.y) / 2];
            var qPath = d3.path();
            qPath.moveTo(fromLocation.x, fromLocation.y);
            qPath.quadraticCurveTo(qCP[0],qCP[1], toLocation.x, toLocation.y-yOffset);

            d3.select("#externalLinks")
              .append("path")
              .attr("id", "external-path-" + normalizeClassName(overedCountryName) + "-" + normalizeClassName(d.country))
              .attr("class",function() {
                return "link-path link external-path link-"+normalizeClassName(overedCountryName)+" link-"+normalizeClassName(d.country)
                  + " link-from-"+normalizeClassName(overedCountryName)+" link-to-"+normalizeClassName(d.country);
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

        let yOffset = 0;

        let i = 0;
        let triangles = {};
        for(i=1;i<=4;i++) {
          triangles[i] = document.getElementById("triangle-" + normalizeClassName(zone) + "-"+i);
        }

        externalLinks.forEach(function(d) {
          var from = document.getElementById('node-' + normalizeClassName(d.from));
          var to = document.getElementById('node-' + normalizeClassName(d.to));

          if(overedCountryName==d.from && !(from == null || to == null)) {
            var fromLocation = triangles[1].getBoundingClientRect();
            var toLocation = to.getBoundingClientRect();
            
            let min = calcDist(fromLocation,toLocation);
            for(i=2;i<=4;i++) {
              let dist = calcDist(triangles[i].getBoundingClientRect(),toLocation);
              if(dist<min) {
                fromLocation = triangles[i].getBoundingClientRect();
                min = dist;
              }
            }

            if(country2zone_dict[d.from] !== country2zone_dict[d.to]) {
              var qCP = [(fromLocation.x + toLocation.x) /2, (fromLocation.y + toLocation.y) / 2];
              var qPath = d3.path();
              qPath.moveTo(fromLocation.x, fromLocation.y);
              qPath.quadraticCurveTo(qCP[0],qCP[1], toLocation.x, toLocation.y-yOffset);

              d3.select("#externalLinks")
                .append("path")
                .attr("class",function() {
                  let from = d.from;
                  let to = d.to;
                  return "link-path link external-path link-"+normalizeZoneName(from)+" link-"+normalizeZoneName(to)
                    + " link-from-"+normalizeZoneName(from)+" link-to-"+normalizeZoneName(to);
                })
                .attr("id",function() {
                  let from = d.from;
                  let to = d.to;
                  return "external-path-"+normalizeZoneName(from)+"-"+normalizeZoneName(to);
                })
                .attr("d", qPath)
                .attr("stroke", "black")
                .attr("style", "fill-opacity:.5;stroke-opacity:.3;z-index:-1;")
                .attr("fill", "none");
            }

          }

          function calcDist(elemBoundRect1,elemBoundRect2) {
            return Math.sqrt(Math.pow((elemBoundRect2.x - elemBoundRect1.x),2) + Math.pow((elemBoundRect2.y - elemBoundRect1.y),2));
          }

        });
        
      },
      deleteExternalLink(from,to) {
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

        Object.keys(chordDiagrams).forEach(function(zone) {
          let dict = chordDiagrams[zone].nodes;
          for (var key in dict) {
            arr.push(key);
          }
        });

        return arr;
      },
      getLinks(nodes) {
        var map = {}, imports = [];

        nodes.forEach(function(d) {
          map[d.data.name] = d;
        });

        nodes.forEach(function(d) {
          if (d.data.links) d.data.links.forEach(function(i) {
            if(map[i.country] !== undefined)
              imports.push(map[d.data.name].path(map[i.country]));
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

        find("",null);
        countries.forEach(function(d) {
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
      pushExternalLink(from,to,qty) {
        this.externalLinks.push({"from":from,"to":to,"quantity":qty});
      },
      highlightCountryFlag(countryName) {
        document.getElementById("node-"+this.normalizeClassName(countryName)).style.opacity = 1;
      },
      findLinksOfCountry(country) {
        let findInternalLinksOfCountry = this.findInternalLinksOfCountry;
        let findExternalLinksOfCountry = this.findExternalLinksOfCountry;

        return findInternalLinksOfCountry(country)
          .concat(findExternalLinksOfCountry(country));
      },
      findInternalLinksOfCountry(country) {
        let chordDiagrams = this.chordDiagrams;
        let country2continent_dict = this.country2continent_dict;
        return chordDiagrams[country2continent_dict[country]].nodes[country].links;
      },
      findExternalLinksOfCountry(country) {
        let links = [];
        let externalLinks = this.externalLinks;
        externalLinks.forEach(function(externalLink) {
          if(externalLink.from === country)
          links.push({"country":externalLink.to,"quantity":externalLink.quantity});
        });

        return links;
      },
      reduceOpacityOfAllCountriesLinks(opacity) {
        let cssSelector = "path.link";
        let elements = document.querySelectorAll(cssSelector);
        elements.forEach((el) => {
          el.style.opacity = opacity;
          el.setAttribute("fill","#aaa");
        });
      },
      increaseLinksOpacityOfSelectedCountries(countries,opacity) {
        let normalizeClassName = this.normalizeClassName;
        countries.forEach(function(country) {
          let cssSelector = ".link-from-" + normalizeClassName(country);
          let elements = document.querySelectorAll(cssSelector);
          elements.forEach((el) => {
            el.style.opacity = opacity
          })
        });
      },
      reduceOpacityOfAllCountriesFlags(opacity) {
        let cssSelector = ".flag";
        let elements = document.querySelectorAll(cssSelector);
        elements.forEach((el) => {
          el.style.opacity = opacity
        });
      },
      increaseFlagOpacityOfSelectedCountries(countries,opacity) {
        let normalizeClassName = this.normalizeClassName;
        countries.forEach(function(country) {
          let cssSelector = "#node-" + normalizeClassName(country.country);
          let elements = document.querySelectorAll(cssSelector);
          elements.forEach((el) => {
            el.style.opacity = opacity
          });
        });
      },
      moveCountryToIsolatedNodes(country) {
        let country2zone_dict = this.country2zone_dict;
        let chordDiagrams = this.chordDiagrams;
        let externalLinks = this.externalLinks;
        let isolatedNodes = this.isolatedNodes;
        let clickedCountryName = country;

        let zoneCountriesNodes = chordDiagrams[country2zone_dict[clickedCountryName]]["nodes"];

        isolatedNodes[clickedCountryName] = zoneCountriesNodes[clickedCountryName];                
        delete chordDiagrams[country2zone_dict[clickedCountryName]]["nodes"][clickedCountryName];
        country2zone_dict[clickedCountryName] = "";
      
        Object.keys(zoneCountriesNodes).forEach(function(country) {
          zoneCountriesNodes[country]["links"].forEach(function(link) {
            if(link === clickedCountryName) {
              externalLinks.push({"from":clickedCountryName,"to":country,"weight":1000});
            }
          });
          zoneCountriesNodes[country]["links"] = zoneCountriesNodes[country]["links"].filter(function (e) {
              let linkCountryName = e.value;
              return linkCountryName !== clickedCountryName;
          });
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

        if(country2zone_dict[country] === "")
          drawExternalLinksIsolatedNode(overedCountryName);
        else
          drawExternalLinks(overedCountryName);

        
        reduceOpacityOfAllCountriesLinks(0.02);
        reduceOpacityOfAllCountriesFlags(0.1);


        increaseLinksOpacityOfSelectedCountries([country],0.7);

        increaseFlagOpacityOfSelectedCountries([{"country":country}],1);
        increaseFlagOpacityOfSelectedCountries(findLinksOfCountry(country),0.6);
      },
      removeHighlightsLinksFromCountry(country) {
        let overedCountryName = country;
        let normalizeClassName = this.normalizeClassName;

        let elements = document.getElementsByClassName("link-path");
        while(elements.length > 0){
          elements[0].parentNode.removeChild(elements[0]);
        }

        let cssSelector = "path.link:not(.link-"+ normalizeClassName(overedCountryName) +")";
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
      showTooltipCountry(countryName,migrationsIn,migrationsOut,event) {
        this.tooltip.style("opacity", 1);
        this.tooltip
          .html("<h4>" + countryName + "</h4>" + "In: " + migrationsIn + "<br>" + "Out: " + migrationsOut)
          .style("left", this.getFlagLocation(countryName).x + 20 + "px")
          .style("top", this.getFlagLocation(countryName).y + "px");
      },
      hideTooltipCountry() {
        this.tooltip.style("opacity", 0);
      },
      getFlagLocation(countryName) {
        let normalizeClassName = this.normalizeClassName;

        var flagElement = document.getElementById('node-' + normalizeClassName(countryName));
        return flagElement.getBoundingClientRect();        
      },
      removeElement(id) {
        let elem = document.getElementById(id);
        return elem.parentNode.removeChild(elem);
      },
      mouseOverWithCtrl() {
      },
      highlightSelectedCountries() {
        let highlightCountryFlag = this.highlightCountryFlag;
        let highlightLinksFromCountry = this.highlightLinksFromCountry;

        selectedCountries.forEach(function(selectedCountry) {
          //highlightLinksFromCountry(selectedCountry);
          highlightCountryFlag(selectedCountry);
        });
      }
    }
  }
  </script>
  