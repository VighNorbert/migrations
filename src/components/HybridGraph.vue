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
      this.HybridGraph(diagram);
    },
    methods: {
      async loadDiagram() {
        let d = await d3.json("../../data/hybrid.json");
        return d;
      },
      HybridGraph(diagram) {
        console.log(diagram);

        let diameter = 500;
        let radius = diameter / 2;
        let innerRadius = radius - 120;
          
        this.cluster = d3.cluster().size([360, innerRadius]);

        this.svg = d3.select("body").append("svg")
          .attr("width", 1920)
          .attr("height", 1080)
          .attr("id", "chordlink")
          .append("g")
          .attr("transform", "translate(" + radius + "," + radius + ")");

        d3.select("#chordlink").append("g").attr("id","externalLinks")
          .attr("transform", "translate(5,-300)"); 

        this.line = d3.radialLine()
          .curve(d3.curveBundle.beta(0.85))
          .radius(function(d) { if(d!=null) return d.y; return 0; })
          .angle(function(d) {
            if(d!=null)
              return d.x / 180 * Math.PI; 
            return 0;
          });
        
        this.drawChordDiagrams(diagram.chordDiagrams);
        this.drawExternalLinks(diagram.externalLinks);
      },
      drawChordDiagrams(chordDiagrams) {
        console.log(chordDiagrams);
        
        let link = {};
        let node = {};

        let svg = this.svg;
        let hierarchy = this.hierarchy;
        let cluster = this.cluster;
        let getLinks = this.getLinks;
        let line = this.line;

        Object.keys(chordDiagrams).forEach(function(zone) {

          console.log("Zone: " + zone);

          node[zone] = svg.append("g")
            .attr("id", "g-" + zone)
            .attr("transform", function() {
              return "translate(" + chordDiagrams[zone]["x"] + "," + chordDiagrams[zone]["y"] + ")";
            }).selectAll(".node");

          const containsKey = (obj, key) => Object.keys(obj).includes(key);

          let arr = [];
          let dict = chordDiagrams[zone].nodes;
          for (var key in dict) {
            if (containsKey(dict,key)) { // hasOwnPropery dict.hasOwn(key)
                arr.push([key, dict[key]]);
            }
          }
          
          let zoneCountries = hierarchy(arr);

          console.log(zoneCountries);

          cluster(zoneCountries);

          node[zone] = node[zone]
            .data(zoneCountries.leaves())
            .enter().append("text")
              .attr("class", function() {
                return "node node-" + zone;
              })
              .attr("id", function(d) {
                return "node-" + d.data.key;
              })
              .attr("dy", "0.31em")
              .attr("transform", function(d) {
                return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 8) + ",0)" + (d.x < 180 ? "" : "rotate(180)"); 
              })
              .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
              .text(function(d) { return d.data.key; })
              .on("mouseover", mouseovered)
              .on("mouseout", mouseouted);

              link[zone] = svg.append("g").selectAll(".link")
    
          link[zone] = link[zone]
            .data(getLinks(zoneCountries.leaves()))
            .enter().append("path")
              .each(function(d) {
                d.source = d[0], d.target = d[d.length - 1];
              })
              .attr("transform", function() {
                return "translate(" + chordDiagrams[zone]["x"] + "," + chordDiagrams[zone]["y"] + ")";
              })
              .attr("class", "link")
              .attr("d", line);


          function mouseovered(d) {
            node[zone]
                .each(function(n) { n.target = n.source = false; });

            link[zone]
                .classed("link--target", function(l) { if (l.target === d) return l.source.source = true; })
                .classed("link--source", function(l) { if (l.source === d) return l.target.target = true; })
              .filter(function(l) { return l.target === d || l.source === d; })
                .raise();

            node[zone]
                .classed("node--target", function(n) { return n.target; })
                .classed("node--source", function(n) { return n.source; });
          }

          function mouseouted() {
            link[zone]
                .classed("link--target", false)
                .classed("link--source", false);

            node[zone]
                .classed("node--target", false)
                .classed("node--source", false);
          }
        });

      },
      drawExternalLinks(externalLinks) {
        let yOffset = 0;

        externalLinks.forEach(function(d) {

          var from = document.getElementById('node-' + d.from);
          var to = document.getElementById('node-' + d.to);


          if(!(from == null || to == null)) {
            var fromLocation = from.getBoundingClientRect();
            var toLocation = to.getBoundingClientRect();

            var qCP = [(fromLocation.x + toLocation.x) / 3, (fromLocation.y + toLocation.y) / 3];
            var qPath = d3.path();
            qPath.moveTo(fromLocation.x, fromLocation.y);
            qPath.quadraticCurveTo(qCP[0],qCP[1], toLocation.x, toLocation.y-yOffset);

            d3.select("#externalLinks")
              .append("path")
              .attr("d", qPath)
              .attr("stroke", "black")
              .attr("style", "fill-opacity:.5;stroke-opacity:.05;z-index:-1;")
              .attr("fill", "none");      
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
      }
    }
  }
  </script>
  