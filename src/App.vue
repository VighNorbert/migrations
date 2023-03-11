<template>
  <nav>
    <ul>
      <li><router-link to="/about">About</router-link></li>
      <li><router-link to="/migrations">Migrations</router-link></li>
    </ul>
  </nav>
  <main>
    <router-view/>
  </main>
</template>

<style>
@import'~bootstrap/dist/css/bootstrap.css';
</style>
