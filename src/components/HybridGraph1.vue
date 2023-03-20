<template>
    <div class="map-canvas">
    </div>
  </template>
  
  <script>
  import * as d3 from 'd3';
  
  export default {
    name: 'HybridGraph',
    async mounted() {
      let diagram = await this.loadDiagram();
      let iso3166 = await this.loadIso3166();
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

        this.line = d3.radialLine()
          .curve(d3.curveBundle.beta(0.85))
          .radius(function(d) { if(d!=null) return d.y; return 0; })
          .angle(function(d) {
            if(d!=null)
              return d.x / 180 * Math.PI; 
            return 0;
          });
        
        this.drawChordDiagrams(diagram, iso3166);
        //this.drawExternalLinks(diagram.externalLinks);

        // d3.selectAll('.chord-diagram').call(drag);
        //this.svg.selectAll('.chord-diagram').call(drag);

      },
      drawChordDiagrams(diagram, iso3166) {
        
        let link = {};
        let node = {};

        let chordDiagrams = diagram.chordDiagrams;
        let externalLinks = diagram.externalLinks;

        let svg = this.svg;
        let hierarchy = this.hierarchy;
        let cluster = this.cluster;
        let getLinks = this.getLinks;
        let line = this.line;
        let drawGuidePoints = this.drawGuidePoints;
        let drawExternalLinks = this.drawExternalLinks;
        let normalizeZoneName = this.normalizeZoneName;

        // build iso3166 dict
        let iso3166_dict = {};
        iso3166.mappings.forEach(function(country) {
          iso3166_dict[country["Name"]] = country["Code"];
        });
        
        Object.keys(chordDiagrams).forEach(function(zone) {

          node[zone] = svg.append("g")
            .attr("id", "g-" + normalizeZoneName(zone))
            .attr("class", "chord-diagram")
            .attr("transform", function() {
              return "translate(" + chordDiagrams[zone]["x"] + "," + chordDiagrams[zone]["y"] + ")";
            })
            .on("click", function() {console.log("clicked");})
            .call(d3.drag()
              .on('start', dragStart)
              .on('drag', dragging)
              .on('end', dragEnd)
            )
            .selectAll(".node");

            function dragStart(){
              console.log("drag start");
              d3.select(this)
                .style("stroke", "")  
            }
            
            function dragging(event){
                var xCoor = event.x;
                var yCoor = event.y;

                d3.select(this)
                  .attr("transform", "translate("+ xCoor + "," + yCoor +")");
            }
            
            function dragEnd(){
              /*d3.select(this)
                .style("stroke", "black")*/
            }
            
          // append a rect to g for letting drag options
          d3.select("#g-" + normalizeZoneName(zone)).append("rect")
          .attr("width", "400px")
          .attr("height", "400px")
          .attr("transform","translate(-200,-200)")
          .style('opacity', 0)
            ;

          // append a circle to g for letting drag options
          d3.select("#g-" + normalizeZoneName(zone)).append("circle")
          .attr("r", "170")
          .attr("fill","white")
          .style('opacity', 1)
            ;

          const containsKey = (obj, key) => Object.keys(obj).includes(key);

          let arr = [];
          let dict = chordDiagrams[zone].nodes;
          for (var key in dict) {
            if (containsKey(dict,key)) { // hasOwnPropery dict.hasOwn(key)
                arr.push([key, dict[key]]);
            }
          }

          drawGuidePoints(zone);
          
          let zoneCountries = hierarchy(arr);

          cluster(zoneCountries);

          node[zone] = node[zone]
            .data(zoneCountries.leaves())
            .enter().append("image")
              .attr("class", function() {
                return "node chord-diagram-text node-" + zone;
              })
              .attr("data-country", function(d) {
                return d.data.key;
              })
              .attr("id", function(d) {
                return "node-" + d.data.key;
              })
              .attr("transform", function(d) {
                return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 10) + ",0)";// + (d.x < 180 ? "" : "rotate(180)"); 
              })
              .attr("href", function(d) {
                return require('@/assets/img/w20/' + iso3166_dict[d.data.key].toString().toLowerCase() + '.png');
              })
              .on("mouseover", mouseovered)
              .on("mouseout", mouseouted);

          link[zone] = svg.select("#g-" + normalizeZoneName(zone)).append("g").selectAll(".link");
    
          link[zone] = link[zone]
            .data(getLinks(zoneCountries.leaves()))
            .enter().append("path")
              .each(function(d) {
                d.source = d[0], d.target = d[d.length - 1];
              })
              .attr("class", "link")
              .attr("d", line);


          function mouseovered(d) {
            let overedCountryName = d.target.__data__.data.key;
            console.log("Mouse over " + overedCountryName);

            drawExternalLinks(overedCountryName, zone, externalLinks);

            /*node[zone]
                .each(function(n) { n.target = n.source = false; });

            link[zone]
                .classed("link--target", function(l) { if (l.target === d) return l.source.source = true; })
                .classed("link--source", function(l) { if (l.source === d) return l.target.target = true; })
              .filter(function(l) { return l.target === d || l.source === d; })
                .raise();

            node[zone]
                .classed("node--target", function(n) { return n.target; })
                .classed("node--source", function(n) { return n.source; });*/
          }

          function mouseouted() {
            /*link[zone]
                .classed("link--target", false)
                .classed("link--source", false);

            node[zone]
                .classed("node--target", false)
                .classed("node--source", false);*/

                let elements = document.getElementsByClassName("link-path");
                while(elements.length > 0){
                  elements[0].parentNode.removeChild(elements[0]);
                }
          }


        });

      },
      drawGuidePoints(zoneName) {

        let normalizeZoneName = this.normalizeZoneName;

        let radius = 150;

        let configurations = [{"x":-radius,"y":-radius,"rotation":-45},{"x":radius,"y":-radius,"rotation":45},
          {"x":radius,"y":radius,"rotation":135},{"x":-radius,"y":radius,"rotation":-135}];

        // console.log("Drawing guides for " + zoneName);
        
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
      drawExternalLinks(overedCountryName, zone, externalLinks) {
        let normalizeZoneName = this.normalizeZoneName;

        let yOffset = 0;

        let i = 0;
        let triangles = {};
        for(i=1;i<=4;i++) {
          triangles[i] = document.getElementById("triangle-" + normalizeZoneName(zone) + "-"+i);
        }

        externalLinks.forEach(function(d) {

          var from = document.getElementById('node-' + d.from);
          var to = document.getElementById('node-' + d.to);

          if(overedCountryName==d.from && !(from == null || to == null)) {
            var fromLocation = triangles[1].getBoundingClientRect();
            var toLocation = to.getBoundingClientRect();
            
            let min = calcDist(fromLocation,toLocation);
            console.log(min);
            for(i=2;i<=4;i++) {
              let dist = calcDist(triangles[i].getBoundingClientRect(),toLocation);
              if(dist<min) {
                fromLocation = triangles[i].getBoundingClientRect();
                min = dist;
              }
            }

            var qCP = [(fromLocation.x + toLocation.x) / 3, (fromLocation.y + toLocation.y) / 3];
            var qPath = d3.path();
            qPath.moveTo(fromLocation.x, fromLocation.y);
            qPath.quadraticCurveTo(qCP[0],qCP[1], toLocation.x, toLocation.y-yOffset);

            d3.select("#externalLinks")
              .append("path")
              .attr("class","link-path")
              .attr("d", qPath)
              .attr("stroke", "black")
              .attr("style", "fill-opacity:.5;stroke-opacity:.3;z-index:-1;")
              .attr("fill", "none");      
          }

          function calcDist(elemBoundRect1,elemBoundRect2) {
            return Math.sqrt(Math.pow((elemBoundRect2.x - elemBoundRect1.x),2) + Math.pow((elemBoundRect2.y - elemBoundRect1.y),2));
          }

        });

      },
      getLinks(nodes) {
        var map = {}, imports = [];

        // Compute a map from name to node
        nodes.forEach(function(d) {
          map[d.data.name] = d;
        });

        nodes.forEach(function(d) {
          if (d.data.links) d.data.links.forEach(function(i) {
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

        find("",null);
        countries.forEach(function(d) {
          find(d[1].name, d[1]);
        });

        return d3.hierarchy(map[""]);
      },
      normalizeZoneName(zoneName) {
        return zoneName.replace(/\s+/g, '-');
      }
    }
  }
  </script>
  