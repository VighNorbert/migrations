<template>

    <div class="btn-group mb-4">
        <button :class="'btn btn-primary ' + (isWorldMap ? 'active' : '')"
                @click="changeLayout('map')">
            World map
        </button>
        <button :class="'btn btn-primary ' + (isForceDirected ? 'active' : '')"
                @click="changeLayout('force')">
            Force Directed Graph
        </button>
        <button :class="'btn btn-primary ' + (isHybrid ? 'active' : '')"
                @click="changeLayout('hybrid')">
            Hybrid Graph
        </button>
    </div>

    <select class="form-control d-inline-block mb-4" v-model="selection" v-if="nodesData">
        <option value="default" selected="selected">No selection</option>
        <optgroup v-for="r in regionsData" :key="r" :label="r">
            <option v-for="c in nodesData.filter(n => n.region === r)" :key="c.code" :value="c.code">
                {{ c.name }}
            </option>
        </optgroup>
    </select>

    <div id="filterSlider"></div>

    <div class="btn-group mb-4">
        <button :class="'btn btn-primary ' + (direction === 'e' ? 'active' : '')"
                @click="changeDirection('e')">
            Show Emigration
        </button>
        <button :class="'btn btn-primary ' + (direction === 'i' ? 'active' : '')"
                @click="changeDirection('i')">
            Show Immigration
        </button>
        <button :class="'btn btn-primary ' + (direction === 'd' ? 'active' : '')"
                @click="changeDirection('d')">
            Show Difference
        </button>
    </div>

    <div id="yearSlider"></div>

    <div>
        <WorldMap
            v-if="isWorldMap"
            :startYearId="startYearId"
            :endYearId="endYearId"
        ></WorldMap>
        <ForceDirectedGraph
            v-if="isForceDirected"
            :direction="direction"
            :selection="selection"
            :migrationThreshold="migrationThreshold"
            @node-clicked="(code) => selection = code"
        ></ForceDirectedGraph>
        <HybridGraph
            v-if="isHybrid"
        ></HybridGraph>
    </div>

</template>

<script>
import * as d3 from 'd3';
import { sliderHorizontal } from 'd3-simple-slider';
import ForceDirectedGraph from "@/components/ForceDirectedGraph.vue";
import WorldMap from "@/components/WorldMap.vue";
import HybridGraph from "@/components/HybridGraph.vue";

export default {
  name: 'VisControls',
  components: {HybridGraph, WorldMap, ForceDirectedGraph},
  data() {
    return {
      layout: 'force',
      direction: 'e',
      nodesData: null,
      regionsData: [],
      linksData: null,
      selection: 'default',
      startYearId: 0,
      endYearId: 6,
      migrationThreshold: 10000
    };
  },
  computed: {
    isWorldMap() {
      return this.layout === 'map';
    },
    isForceDirected() {
      return this.layout === 'force';
    },
    isHybrid() {
      return this.layout === 'hybrid';
    },
  },
  async created() {
    this.nodesData = await this.loadNodes();
    this.linksData = await this.loadLinks();
    this.startYearId = 0;
    this.endYearId = 6;
    this.startYear = 1990;
    this.endYear = 2020;
  },
  mounted() {
    let filterSlider = sliderHorizontal()
        .min(0)
        .max(1000000)
        .value(this.migrationThreshold)
        .width(600)
        .step(0.1)
        .ticks(12)
        .tickFormat(d3.format("d"))
        .displayValue(false)
        .on('onchange', (value) => {
          this.migrationThreshold = value;
        });

    d3.select('#filterSlider')
        .append('svg')
        .attr('width', 660)
        .attr('height', 70)
        .append('g')
        .attr('transform', 'translate(30,20)')
        .call(filterSlider);

    let timestamps = [1990, 1995, 2000, 2005, 2010, 2015, 2020];
    let yearSlider = sliderHorizontal()
        .min(1990)
        .max(2020)
        .value([1990, 2020])
        .width(600)
        .step(5)
        .tickValues(timestamps)
        .tickFormat(d3.format("d"))
        .displayValue(false)
        .on('onchange', (value) => {
          this.startYear = value[0];
          this.endYear = value[1];

          this.startYearId = timestamps.findIndex((x) => x === value[0]);
          this.endYearId = timestamps.findIndex((x) => x === value[1]);
        });

    d3.select('#yearSlider')
        .append('svg')
        .attr('width', 660)
        .attr('height', 70)
        .append('g')
        .attr('transform', 'translate(30,20)')
        .call(yearSlider);
  },
  methods: {
    changeLayout(view) {
      this.layout = view;
    },
    async loadNodes() {
      let c = await d3.json("../../data/countries.json");
      c.map(d => {
        d.group = d.region;
      });
      this.regionsData = [
        ...new Set(
            c.map(d => d.region)
        )
      ];
      return c;
    },

    async loadLinks() {
      let c = await d3.json("../../data/migration.json");
      c = c.filter(d => d.total[5] > 10000);
      return c;
    },

    changeDirection(direction) {
      this.direction = direction;
    },

    toggleLayout() {
      if (this.layout === 'force') {
        this.layout = 'radial';
      } else {
        this.layout = 'force';
      }
    },
  }
}
</script>
