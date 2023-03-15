<template>
  <h1>Migrations</h1>
  <ForceDirectedGraph></ForceDirectedGraph>
  <WorldMap></WorldMap>
</template>

<script>
import ForceDirectedGraph from "@/components/ForceDirectedGraph.vue";
import WorldMap from "@/components/WorldMap.vue";

export default {
  name: 'MigrationsView',
  components: {
    ForceDirectedGraph,
    WorldMap
  }
}
</script>
