<template>
  <h1>Migrations</h1>
  <ForceDirectedGraph></ForceDirectedGraph>
</template>

<script>
import ForceDirectedGraph from "@/components/ForceDirectedGraph.vue";

export default {
  name: 'MigrationsView',
  components: {
    ForceDirectedGraph
  }
}
</script>
