<template>
    <nav>
        <h1 class="m-0"><strong>Migration</strong>Visualization</h1>
    </nav>
    <main>
        <div class="d-flex">
            <section class="card" id="filtersCard">
                <h2>Filters and Selection</h2>
                <div class="row">
                    <div class="col-3 d-flex align-items-center">
                        <label for="selection" class="mb-2">
                            Selection
                        </label>
                    </div>
                    <div class="col-9">
                        <select class="form-select d-inline-block mb-2" name="selection" id="selection"
                                v-model="selection" v-if="nodesData">
                            <option value="default" selected="selected">No selection</option>
                            <optgroup v-for="r in regionsData" :key="r" :label="r">
                                <option v-for="c in nodesData.filter(n => n.region === r)" :key="c.code"
                                        :value="c.code">
                                    {{ c.name }}
                                </option>
                            </optgroup>
                        </select>
                    </div>
                </div>

                <div class="row">
                    <div class="col-3 d-flex align-items-center">
                        <label for="filterSlider">
                            Migration threshold
                        </label>
                    </div>
                    <div class="col-9 p-0">
                        <div id="filterSlider"></div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-3 d-flex align-items-center">
                        <label for="direction">
                            Direction
                        </label>
                    </div>
                    <div class="col-9">
                        <div class="btn-group my-2" id="direction">
                            <button :class="'btn btn-outline-dark ' + (direction === 'e' ? 'active' : '')"
                                    @click="changeDirection('e')">
                                Show Emigration
                            </button>
                            <button :class="'btn btn-outline-dark ' + (direction === 'i' ? 'active' : '')"
                                    @click="changeDirection('i')">
                                Show Immigration
                            </button>
                            <button :class="'btn btn-outline-dark ' + (direction === 'd' ? 'active' : '')"
                                    @click="changeDirection('d')">
                                Show Difference
                            </button>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-3 d-flex align-items-center">
                        <label for="yearSlider">
                            Show data for year range
                        </label>
                    </div>
                    <div class="col-9 p-0">
                        <div id="yearSlider"></div>
                    </div>
                </div>
            </section>
            <section class="card d-none d-xl-block" id="about">

                <h2>About</h2>

                <p>
                    This is a visualization tool for the
                    <a href="https://www.un.org/development/desa/pd/data/global-migration-database">Migrations</a>
                    dataset. It is built with
                    <a href="https://vuejs.org/">Vue.js</a> and <a href="https://d3js.org/">D3.js</a>.
                </p>
                <p>
                    The data is fetched from the <a href="https://data.un.org/">UN Data API</a> and
                    <a href="https://restcountries.com/">Restcountries API</a>.
                </p>

                <h3 class="fs-4">Authors</h3>
                <ul>
                    <li>Norbert Vígh @VighNorbert</li>
                    <li>Hanna Balaka @Annchovy</li>
                    <li>Daniele Fippi @phi998</li>
                </ul>
                <p>
                    This work was done at the <a href="https://uib.no/">University of Bergen</a>, Norway, as part of
                    the course INF252 Visualization.
                </p>
            </section>
        </div>


        <div class="tabs">
            <div class="btns">
                <button :class="'btn ' + (isWorldMap ? ' btn-primary' : 'btn-outline-secondary')"
                        @click="changeLayout('map')">
                    World map
                </button>
                <button :class="'btn ' + (isForceDirected ? 'btn-primary' : 'btn-outline-secondary')"
                        @click="changeLayout('force')">
                    Force Directed Graph
                </button>
                <button :class="'btn ' + (isHybrid ? ' btn-primary' : 'btn-outline-secondary')"
                        @click="changeLayout('hybrid')">
                    Hybrid Graph
                </button>
            </div>
        </div>

        <svg v-if="isForceDirected && !forceSetup" xmlns="http://www.w3.org/2000/svg" width="32" height="32"
             fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16" @click="toggleForceSetup()">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>

        <div v-if="isForceDirected && forceSetup" id="force-setup">
            <div class="d-flex justify-content-between">
                <h2>Force Multipliers</h2>
                <button type="button" class="btn-close" @click="toggleForceSetup()"></button>
            </div>
            <small>Altering the forces might result in an unstable visualisation.</small>

            <div class="form-group row">
                <div class="col-5">
                    <label for="linkForceScaling">Scaling of Link Force</label>
                </div>
                <div class="col-7">
                    <select id="linkForceScaling" name="linkForceScaling" v-model="linkForceScaling"
                            class="form-select">
                        <option value="equal">All equal</option>
                        <option value="log">Log scaling</option>
                        <option value="log10">Log10 scaling</option>
                    </select>
                </div>
            </div>
            <div class="form-group row">
                <div class="col-5">
                    <label for="linkForceMultiplier">Link</label>
                    <small>{{ linkForceMultiplier }}x</small>
                </div>
                <div class="col-7">
                    <input type="range" id="linkForceMultiplier" class="form-range"
                           name="linkForceMultiplier" min="0.01" max="10" step="0.01"
                           v-model="linkForceMultiplier">
                </div>
            </div>
            <div class="form-group row">
                <div class="col-5">
                    <label for="chargeForceMultiplier">Charge</label>
                    <small>{{ chargeForceMultiplier }}x</small>
                </div>
                <div class="col-7">
                    <input type="range" id="chargeForceMultiplier" class="form-range"
                           name="chargeForceMultiplier" min="0.01" max="10" step="0.01"
                           v-model="chargeForceMultiplier">
                </div>
            </div>
            <div class="form-group row">
                <div class="col-5">
                    <label for="centeringForceMultiplier">Centering</label>
                    <small>{{ centeringForceMultiplier }}x</small>
                </div>
                <div class="col-7">
                    <input type="range" id="centeringForceMultiplier" class="form-range"
                           name="centeringForceMultiplier" min="0.01" max="10" step="0.01"
                           v-model="centeringForceMultiplier">
                </div>
            </div>
            <div class="form-group row">
                <div class="col-5">
                    <label for="radialForceMultiplier">Radial</label>
                    <small>{{ radialForceMultiplier }}x</small>
                </div>
                <div class="col-7">
                    <input type="range" id="radialForceMultiplier" class="form-range"
                           name="radialForceMultiplier" min="0.01" max="10" step="0.01"
                           v-model="radialForceMultiplier">
                </div>
            </div>
            <div class="form-group row">
                <div class="col-5">
                    <label for="radius">Radius</label>
                    <small>{{ radius }}px</small>
                </div>
                <div class="col-7">
                    <input type="range" id="radius" class="form-range"
                           name="radius" min="50" max="500" step="50"
                           v-model="radius">
                </div>
            </div>
        </div>

        <div>
            <WorldMap
                    v-if="isWorldMap"
                    :direction="direction"
                    :selection="selection"
                    :startYearId="startYearId"
                    :endYearId="endYearId"
                    :migrationThreshold="migrationThreshold"
            ></WorldMap>
            <ForceDirectedGraph
                    v-if="isForceDirected"
                    :direction="direction"
                    :selection="selection"
                    :startYearId="startYearId"
                    :endYearId="endYearId"
                    :linkForceMultiplierInput="linkForceMultiplier"
                    :chargeForceMultiplierInput="chargeForceMultiplier"
                    :radialForceMultiplierInput="radialForceMultiplier"
                    :centeringForceMultiplierInput="centeringForceMultiplier"
                    :linkForceScaling="linkForceScaling"
                    :radiusInput="radius"
                    :migrationThreshold="migrationThreshold"
                    @node-clicked="(code) => selection = code"
            ></ForceDirectedGraph>
            <HybridGraph
                    v-if="isHybrid"
                    :startYearId="startYearId"
                    :endYearId="endYearId"
                    :direction="direction"
                    :selection="selection"
                    :migrationThreshold="migrationThreshold"
                    @node-clicked="(code) => selection = code"
            ></HybridGraph>
        </div>
    </main>

</template>

<script>
import * as d3 from 'd3';
import {sliderHorizontal} from 'd3-simple-slider';
import ForceDirectedGraph from "@/components/ForceDirectedGraph.vue";
import WorldMap from "@/components/WorldMap.vue";
import HybridGraph from "@/components/HybridGraph.vue";

export default {
  name: 'VisControls',
  components: {HybridGraph, WorldMap, ForceDirectedGraph},
  data() {
    return {
      layout: 'map',
      direction: 'e',
      nodesData: null,
      regionsData: [],
      linksData: null,
      selection: 'default',
      linkForceScaling: 'log10',
      linkForceMultiplier: '1',
      chargeForceMultiplier: '1',
      radialForceMultiplier: '1',
      centeringForceMultiplier: '1',
      radius: '100',
      forceSetup: false,
      startYearId: 0,
      endYearId: 6,
      migrationThreshold: 100000
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
  },
  mounted() {
    let filterSlider = sliderHorizontal()
        .min(0)
        .max(1000000)
        .value(this.migrationThreshold)
        .width(680)
        .step(0.1)
        .ticks(12)
        .tickFormat(d3.format("d"))
        .displayValue(false)
        .on('end', (value) => {
          this.migrationThreshold = value;
        });

    d3.select('#filterSlider')
        .append('svg')
        .attr('width', 740)
        .attr('height', 70)
        .append('g')
        .attr('transform', 'translate(30,20)')
        .call(filterSlider);

    let timestamps = [1990, 1995, 2000, 2005, 2010, 2015, 2020];
    let yearSlider = sliderHorizontal()
        .min(1990)
        .max(2020)
        .value([1990, 2020])
        .width(680)
        .step(5)
        .tickValues(timestamps)
        .tickFormat(d3.format("d"))
        .displayValue(false)
        .on('end', (value) => {
          this.startYearId = timestamps.findIndex((x) => x === value[0]);
          this.endYearId = timestamps.findIndex((x) => x === value[1]);
        });

    d3.select('#yearSlider')
        .append('svg')
        .attr('width', 740)
        .attr('height', 70)
        .append('g')
        .attr('transform', 'translate(30,20)')
        .call(yearSlider);
  },
  methods: {
    toggleForceSetup() {
      this.forceSetup = !this.forceSetup;
    },
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

<style>
#filtersCard {
    width: 1000px;
}

#about {
    width: calc(100% - 1000px - 64px);
}

.tabs {
    z-index: 999;
    position: relative;
    margin: 16px 16px 0 16px;
    padding: 8px 16px 0 16px;
}

.tabs .btns button {
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    margin: 0 4px;
    border-bottom: 0;
}

#force-setup .form-group {
    min-height: 45px;
}

#force-setup {
    width: 500px;
    position: absolute;
    padding: 16px;
    right: 32px;
    margin-top: 16px;
    background-color: #f8f8ffaa;
    box-shadow: 0 0 8px #00000055;
    border-radius: 8px;
}

.bi-gear {
    right: 32px;
    margin-top: 16px;
    position: absolute;
    color: #ccc;
}

.bi-gear:hover {
    cursor: pointer;
    color: black;
}

.form-group div {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.btn-outline-secondary {
    background: white;
}
</style>
