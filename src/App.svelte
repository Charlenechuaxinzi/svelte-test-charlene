<script>
  import Scroller from "@sveltejs/svelte-scroller";

  let color = "#5cc6b2";

  // FOR SCROLLER COMPONENT

  let count;
  let index;
  let offset;
  let progress;
  let top;
  let threshold = 1.5;
//   let threshold = 0.9;
  let bottom = 0.9;
</script>

<main class="body">
  <Scroller
    {top}
    {bottom}
    {threshold}
    splitscreen={true}
    bind:index
    bind:offset
    bind:progress
    bind:count
  >
    <div slot="background">
      {#if index === 1}
        <div />
      {/if}
      {#if index === 2}
	  <div class="container">
        <img
          src="./img/map.png"
          alt=""
          class="image"
        />
	  </div>
      {/if}
      {#if index === 3}
        <div class="container">
          <img
            src="./img/miles-driven.png"
            alt=""
			class="image"
          />
        </div>
      {/if}
      {#if index === 4}
        <div class="container">
          <video
            controls
            autoplay
			class="video"
          >
            <source src="./img/wine-tastings.mp4" type="video/mp4" />
          </video>
        </div>
      {/if}
      {#if index === 5}
        <div class="container">
          <img
            src="./img/pies.png"
            alt=""
			class="image"
          />
        </div>
      {/if}
      {#if index === 6}
        <div class="container">
          <img
            src="./img/ham-and-cheese.jpg"
            alt=""
			class="image"
          />
        </div>
      {/if}
      {#if index === 7}
        <div class="container">
			<video
            controls
            autoplay
			class="video"
          >
            <source src="./img/meltdowns.mp4" type="video/mp4" />
          </video>
        </div>
      {/if}
      {#if index === 8}
        <div class="container">
          <img
            src="./img/spin.png"
            alt=""
			class="image"
          />
        </div>
      {/if}
      {#if index === 9}
        <div class="container">
          <img
            src="./img/david-test.jpg"
            alt=""
			class="image"
          />
        </div>
      {/if}
      {#if index === 10}
        <div class="container">
			<video
            controls
            autoplay
			class="video"
          >
            <source src="./img/cows.mp4" type="video/mp4" />
          </video>
        </div>
      {/if}
      {#if index === 11}
        <div class="container">
          <img
            src="./img/meals.png"
            alt=""
			class="image"
          />
        </div>
      {/if}
      {#if index === 12}
        <div class="container">
          <video
            controls
            autoplay
			class="video"
          >
            <source src="./img/avocado.mp4" type="video/mp4" />
          </video>
        </div>
      {/if}
	  {#if index === 13}
	  <div class="container">
		<img
		  src="./img/tas.png"
		  alt=""
		  class="image"
		/>
	  </div>
	{/if}
	{#if index === 14}
	<div class="container">
	  <img
		src="./img/melb.png"
		alt=""
		class="image"
	  />
	</div>
  {/if}
    </div>

    <div slot="foreground">
      <section>
        <div class="text">
          <p>
            London but now <b>Aussie 2023</b> 🇦🇺,<br>
			<i>in numbers (and maps)</i><br>
			<br>
            Scroll to continue
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>Cities: 4</p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            Distance driven: 3120.7km<br />
            (It's also 16.2 times the coast of 🇸🇬)
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p><b>Wine tastings: 🍷🍷🍷 </b><br>
			<br>
			• Cabbage hill: the one I want to get married in<br>
			• Tamar Valley: where you almost sold the dude Hougang<br>
			• Innocent Bystander: where we went home with 6 bottles and ate paella<br>
		</p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            <b>Pies 🥧</b><br />
            Total pies: 27<br />
            Shared pies: 7<br />
            Char: 11 whole pies<br />
            Freda: 9 whole pies
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>Ham & cheese croissants: I FORGOT SIS, but MANY.</p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>Mental breakdowns: 404 ERROR</p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            AMAZING spin classes: 9<br />
            Bad spin classes: 1
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            Crushes: 2<br />
            Funerals held: 1
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            Cows we saw: Infinity<br />
            Cows we ate: ~15<br />
            Cows that died for no reason: 1
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>Hearty meals with godma: 4</p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            Avocadoes: 5kg?<br />
            Avocado smash: 5kg?
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            Disclaimer: All numbers here are not fact-checked, but happy birthday froggiefoo!<br>
            Thanks for being the best travel buddy!
          </p>
        </div>
      </section>
      <section>
        <div class="text">
          <p>
            Cheers to more days of <b>thriving 🌱</b>
          </p>
        </div>
      </section>
	  <section>
      </section>
    </div>
  </Scroller>
</main>

<style>
  main {
    padding: 1em;
    margin: 0 auto;
	font-family: Georgia, serif;
  }

  [slot="foreground"] {
    pointer-events: none;
  }

  [slot="foreground"] section {
    pointer-events: all;
  }

  section {
    height: 90vh;
    padding: 1em;
    margin: 0 0 2em 0;
	display: flex;
  	align-items: center;
 	justify-content: center;
  }

  .text {
    background-color: #edede9e1;
    /* top | right | bottom | left */
    padding: 10px 20px 10px 20px;
    border: solid #c2a19d;
	width: 400px;
    margin: auto;
    color: #c2a19d;
  }

  .body {
    background-color: #edede9;
  }

  .video{
	display: block; 
	margin-left: auto; 
	margin-right: auto;
	width: 400px;
  }

  .image{
   width: 400px;
   /* opacity: 1; /* Set initial opacity to fully visible */
   /* transition: opacity 10s ease-in; */
  	}

  .container {
	display: flex;
  	align-items: center;
 	justify-content: center;
 	height: 100vh;
  }

</style>
