// Simon Rhe
// April 2020

const MAP_DATA_URL = 'counties.json';
const EMPLOYMENT_DATA_URL = 'for_user_education.json';

const SVG_DIV = d3.select('#chart-div');
let svgElement = d3.select('#chart-svg');

let mapData;
let employmentData;

let pathGenerator = d3.geoPath();

// Load map and employment data
Promise.all([ d3.json(MAP_DATA_URL), d3.json(EMPLOYMENT_DATA_URL) ])
	.then((values) => {
		mapData = values[0];
		employmentData = values[1];
		generateMap(svgElement, mapData, employmentData, SVG_DIV);
	})
	.catch((error) => console.log('error: ' + error));

function generateMap(svg, mapData, employmentData, svgDiv) {

	// Generate array of GeoJSON Features for the GeometryCollection of US counties
	// and add link to employment data to avoid multiple calls to Array.find when drawing
	let topoFeatures = topojson.feature(mapData, mapData.objects.counties).features;
	topoFeatures.forEach((county) => {
		let countyData = employmentData.find((e) => e.fips == county.id);
		if (countyData != undefined) {
			county.employmentData = countyData;
		}
		// TODO: what if county data is not found?
	});

	// Generate color scale
	const colorScheme = d3.schemePRGn[10]; // https://github.com/d3/d3-scale-chromatic/blob/v1.5.0/README.md#schemeBlues
	const dataExtent = d3.extent(employmentData, (d) => d.bachelorsOrHigher);
	const colorScale = d3.scaleQuantize(dataExtent, colorScheme);

	// Generate color legend based on color scheme
	let legendG = svg.append('g').attr('id', 'legend').attr('transform', 'translate(530, 5)');
	legendG
		.selectAll('rect')
		.data(colorScheme)
		.enter()
		.append('rect')
		.attr('x', (d, i) => 20 + i * 30)
		.attr('y', 20)
		.attr('width', 30)
		.attr('height', 20)
		.attr('fill', (d) => d);
	let firstTick = colorScale.invertExtent(colorScheme[0])[0];
	const colorScaleTicks = colorScheme.map((v) => colorScale.invertExtent(v)[1]);
	colorScaleTicks.unshift(firstTick);
	const colorLegendScale = d3.scaleLinear(dataExtent, [ 0, colorScheme.length * 30 ]);
	const colorLegendAxis = d3.axisBottom(colorLegendScale).tickValues(colorScaleTicks).tickFormat(d3.format('.0f'));
	legendG.append('g').attr('transform', 'translate(19.5, 40)').attr('id', 'color-legend-axis').call(colorLegendAxis);
	legendG
		.append('text')
		.attr('x', 100)
		.attr('y', 10)
		.attr('class', 'legend-text')
		.text('Bachelor degree or higher (%)');

	// Generate tooltip
	let tooltipDiv = svgDiv.append('div').attr('id', 'tooltip').attr('class', 'tooltip-div').style('opacity', 0);

	// Draw counties
	// include FIPS code: Federal Information Processing Standard https://en.wikipedia.org/wiki/FIPS_county_code
	svg
		.append('g')
		.attr('class', 'counties')
		.selectAll('path')
		.data(topoFeatures)
		.enter()
		.append('path')
		.attr('d', pathGenerator)
		.attr('class', 'county')
		.attr('data-fips', (c) => c.id)
		.attr('data-education', (c) => c.employmentData.bachelorsOrHigher)
		.attr('fill', (c) => colorScale(c.employmentData.bachelorsOrHigher))
		.on('mouseover', (c, i) => {
			let newHtml =
				'<strong>' +
				c.employmentData.area_name +
				', ' +
				c.employmentData.state +
				'</strong><br>' +
				c.employmentData.bachelorsOrHigher +
				'%';
			tooltipDiv
				.html(newHtml)
				.attr('data-education', c.employmentData.bachelorsOrHigher)
				.style('opacity', 0.9)
				.style('left', d3.event.pageX + 10 + 'px')
				.style('top', d3.event.pageY - 28 + 'px');
		})
		.on('mouseout', (d, i) => {
			tooltipDiv.style('opacity', 0);
		});

	// Draw state lines

	// topojson.mesh returns GeoJSON MultiLineString geometry object,
	// in which edges that are shared by multiple features are only stroked once
	// see: https://github.com/topojson/topojson-client/blob/master/README.md#mesh
	let stateLines = topojson.mesh(mapData, mapData.objects.states, (a, b) => a !== b);
	svg
		.append('path')
		.datum(stateLines) /* use datum when only one element, not collection */
		.attr('id', 'state-lines')
		.attr('d', pathGenerator);
}