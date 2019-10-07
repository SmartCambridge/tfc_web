/* globals d3, moment */
/* exported draw_graph */

// Bar colour sequence
var colors = ['royalblue', 'cornflowerblue'];

// Graph container
var margin = {top: 20, right: 100, bottom: 35, left: 50};

var resizeTimer;

function stacked_bar_graph(data, columns, ylabel) {
    draw_graph(data, columns, ylabel, stacked_bar_graph_internal);
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            draw_graph(data, columns, ylabel, stacked_bar_graph_internal);
        }, 250);
    });
}

function dot_graph(data, columns, ylabel) {
    draw_graph(data, columns, ylabel, dot_graph_internal);
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            draw_graph(data, columns, ylabel, dot_graph_internal);
        }, 250);
    });
}

function draw_graph(data, columns, ylabel, grapher) {

    // get the height and width of the "chart" div, and set d3 svg element to that
    var chart_width = document.getElementById('chart').clientWidth;
    var chart_height = document.getElementById('chart').clientHeight;

    var width = chart_width - margin.left - margin.right;
    var height = chart_height - margin.top - margin.bottom;

    // X and Y scales
    var x = d3.scaleTime().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);

    // X and Y axes
    var xAxis = d3.axisBottom()
        .scale(x);
        //.tickFormat(d3.timeFormat('%Y-%m-%d'));

    var yAxis = d3.axisLeft()
        .scale(y)
        .tickSize(-width, 0, 0)
        .ticks(5);

    d3.selectAll('#chart svg').remove();
    var svg = d3.select('#chart').append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var col_names = Object.keys(columns);
    data.forEach(function(d) {
        d.Date = d3.isoParse(d.Date);
        col_names.forEach(function(col) {
            d[col] = +d[col];
        });
    });

    // Set the domains (ranges) for the two scales
    var date_range = d3.extent(data, function(d) { return d.Date; });
    x.domain([date_range[0], add_days(date_range[1], 7)]).nice();

    // Actually draw the graph
    grapher(svg, data, columns, x, y);

    // Axis labels
    svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .call(xAxis);

    svg.append('g')
        .attr('class', 'y axis')
        .call(yAxis);

    svg.append('text')
        .attr('class', 'ylabel')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text(ylabel);

    // Legend
    if (Object.keys(columns).length > 1) {
        var legend = svg.selectAll('.legend')
            .data(Object.values(columns).reverse())
            .enter().append('g')
            .attr('class', 'legend')
            .attr('transform', function(d, i) { return 'translate(30,' + i * 19 + ')'; });

        legend.append('rect')
            .attr('x', width - 18)
            .attr('width', 18)
            .attr('height', 18)
            .style('fill', function(d, i) {return colors.slice().reverse()[i];});

        legend.append('text')
            .attr('x', width + 5)
            .attr('y', 9)
            .attr('dy', '.35em')
            .style('text-anchor', 'start')
            .text(function(d) {
                return d;
            });
    }

}

function stacked_bar_graph_internal(svg, data, columns, x, y) {

    // Extract the column names
    var col_names = Object.keys(columns);

    var max_stacked = d3.max(data, function(d) { return d3.sum(col_names, function(k) { return +d[k]; }); });
    y.domain([0, max_stacked]).nice();

    // Pixel width of one week on the x-axis
    var date_range = d3.extent(data, function(d) { return d.Date; });
    var bar_width = (x(add_days(date_range[0], 7)) - x(date_range[0])) - 2;

    // Build a copy of data with each sequence stacked on the previous one
    var dataset = d3.stack().keys(col_names)(data);

    // Create groups for each series, rects for each segment
    var groups = svg.selectAll('g.count')
        .data(dataset)
        .enter().append('g')
        .attr('class', 'count')
        .style('fill', function(d, i) { return colors[i]; });

    groups.selectAll('rect')
        .data(function(d) { return d; })
        .enter()
        .append('rect')
        .attr('x', function(d) { return x(d.data.Date); })
        .attr('y', function(d) { return y(d[1]); })
        .attr('height', function(d) { return y(d[0]) - y(d[1]); })
        .attr('width', bar_width)
        .on('mouseover', function() { tooltip.style('display', null); })
        .on('mouseout', function() { tooltip.style('display', 'none'); })
        .on('mousemove', function(d) {
            var xPosition = d3.mouse(this)[0] - 15;
            var yPosition = d3.mouse(this)[1] - 25;
            tooltip.attr('transform', 'translate(' + xPosition + ',' + yPosition + ')');
            tooltip.select('text').text(d[1] - d[0]);
        });

    // Tooltips
    var tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .style('display', 'none');

    tooltip.append('rect')
        .attr('width', 30)
        .attr('height', 20)
        .attr('fill', 'white')
        .style('opacity', 0.5);

    tooltip.append('text')
        .attr('x', 15)
        .attr('dy', '1.2em')
        .style('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold');

}

function dot_graph_internal(svg, data, columns, x, y) {

    // Extract the column names
    var col_names = Object.keys(columns);

    var max = d3.max(data, function(d) { return d3.max(col_names, function(k) { return +d[k]; }); });
    y.domain([0, max]).nice();

    for (var col = 0; col < col_names.length; ++col) {
        var col_name = col_names[col];
        svg.selectAll('.dot_' + col_name)
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'dot dot_' + col_name)
            .attr('cx', function(d) { return x(d.Date); })
            .attr('cy', function(d) { return y(d[col_name]); })
            .attr('r', 6)
            .style('fill', function() { return colors[col]; })
            .on('mouseover', function() { tooltip.style('display', null); })
            .on('mouseout', function() { tooltip.style('display', 'none'); })
            .on('mousemove', function(d) {
                var xPosition = d3.mouse(this)[0] - 70;
                var yPosition = d3.mouse(this)[1] - 25;
                tooltip.attr('transform', 'translate(' + xPosition + ',' + yPosition + ')');
                tooltip.select('text').text(moment(d.Date).format('YYYY-MM-DD') + ' ' + columns[col_name] + ': ' + d[col_name]);
            });
    }

    // Tooltips
    var tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .style('display', 'none');

    tooltip.append('rect')
        .attr('width', 140)
        .attr('height', 20)
        .attr('fill', 'white')
        .style('opacity', 1);

    tooltip.append('text')
        .attr('x', 70)
        .attr('dy', '1.2em')
        .style('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold');

}

function add_days(date, days) {
    var copy = new Date(Number(date));
    copy.setDate(date.getDate() + days);
    return copy;
}
