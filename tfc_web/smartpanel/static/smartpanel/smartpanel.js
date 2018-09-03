

// JS code for layout_config
//
// Is loaded by the smartpanel template layout_config.html
//
// Note the layout_config.html template initializes the global var "layout_design" to contain the current 'design' JSON,
// i.e. the grid definition and the widget data (i.e. name and params):
// { grid: { columns: 6, rows:4, ratio: 1.88 }                 -- grid dimensions and approx shape of drawning area
//   widgets: { "0": { x: 1, y: 1, w: 1, h: 2,                 -- position and size on grid
//                     widget: "weather",                      -- widget type
//                     data: { location: "310105"},            -- widget params
//                     placeholder: { title: "Luton Weather" } -- info for widget on layout_config
//                   }
//              "1": ... more widgets
//            }
// }
//
//
// This design has been loaded from the Django layouts table.  This config can be viewed easily via the 'Export' button.
//
// This code uses the gridstack.js library https://github.com/gridstack/gridstack.js/tree/develop/doc
//
"use strict"; // javascript mode for better error checking

$(function () {

    var GRID_RATIO_LANDSCAPE = 1.88; // (display width / (display height - header height)) (using 1920/(1080-60))
    var GRID_RATIO_PORTRAIT = 0.53;
    var GRID_RATIO_DEFAULT = GRID_RATIO_LANDSCAPE;

    var GRID_COLUMNS_MAX = 12; // gridster limitation in CSS - could be increased with custom CSS file
    var GRID_COLUMNS_DEFAULT = 6; // for a new layout, or existing layout from prior version with no grid info
    var GRID_ROWS_DEFAULT = 4;
    var GRID_ORIENTATION_DEFAULT = 'landscape';

    // *******************************************************************************************
    // GLOBALS
    // *******************************************************************************************
    var grid_container; // The DOM element provided on the layout_config template for the grid

    var grid;

    var next_widget_id;

    // **************************************************************************
    // ***  Widget grid DOM element create and button callbacks *****************
    // **************************************************************************
    //
    // Create the gridstack DOM element for a 'widget' definition
    function widget_el(id, title, text) {
        if( typeof title == 'undefined' || title === null ) {
            title = "Click configure button"
        }
        if( typeof text == 'undefined' || text === null ) {
            text = ""
        }
        return $(
            // data-gs-locked=true prevents widget being automatically moved to create space for another
            '<div data-gs-locked=true>'+
            '    <div id="section-'+id+'" class="grid-stack-item-content">\n' +
            '        <div style="width: 100%; text-align: center; padding-top: 10px; padding-bottom: 10px">\n' +
            // widget EDIT button
            '            <a id="edit-widget-button-'+id+'"'+
            '               class="edit-widget mdl-button mdl-js-button ' +
            '                      mdl-button--raised mdl-js-ripple-effect mdl-button--colored"'+
            '               data-widget-id="'+id+'" >\n' +
            '                <i class="material-icons">build</i>'+
            '            </a>\n' +
            '            <div class="mdl-tooltip" data-mdl-for="edit-widget-button-'+id+'">Configure widget</div>\n' +
            // widget DELETE button
            '            <a id="delete-widget-button-'+id+'"'+
            '               class="delete-widget mdl-button mdl-js-button ' +
            '                      mdl-button--raised mdl-js-ripple-effect mdl-button--colored"'+
            '               data-widget-id="'+id+'" >\n' +
            '                <i class="material-icons">delete</i>'+
            '            </a>\n' +
            '            <div class="mdl-tooltip" data-mdl-for="delete-widget-button-'+id+'">Delete widget</div>\n' +
            '        </div>\n' +
            // widget PLACEHOLDER text
            '        <div id="widget-'+id+'" class="widget-configured-text"><h1>'+title+'</h1><p>'+text+'</p></div>\n' +
            '    </div>'+
            '</div>');
    }

    // Create 'onClick' function for the widget DELETE button included in the 'widget_el()' DOM above
    function setup_delete_button(widget) {
        widget.find('.delete-widget').click(function (e) {
            e.preventDefault();
            var widget_id = $(e.currentTarget).data('widget-id').toString();
            delete layout_design.widgets[widget_id];
            grid.removeWidget($("#section-"+widget_id).parent());
        });
    }

    // Create 'onClick' callback for widget EDIT button
    function setup_edit_button(widget) {
        widget.find('.edit-widget').click(function (e) {
            active_widget_id = $(e.currentTarget).data('widget-id').toString();
            // We check if the widget has already a configuration
            if (Object.keys(layout_design.widgets).indexOf(active_widget_id) > -1)
                $("#widget-selector").val(layout_design.widgets[active_widget_id]['widget']).trigger("change");
            else
                $("#widget-selector").prop('selectedIndex', 0);
            $('#overlay-configure-widget').css( "display", "flex" );
            $('body').css('overflow','hidden');
        });
    }

    // **************************************************************************
    // *** Grid 'add widget' functions (either new, or from existing design *****
    // **************************************************************************
    function add_new_widget(width,height) {
        var new_widget = grid.addWidget(widget_el(next_widget_id, null, null),
                                        null, // x
                                        null, // y
                                        width,
                                        height,
                                        true,
                                        null,
                                        null,
                                        null,
                                        null,
                                        next_widget_id);
        setup_delete_button(new_widget);
        setup_edit_button(new_widget);
        // Draw tooltips (Material Design Lite handler)
        componentHandler.upgradeDom();
        next_widget_id += 1;
    }

    // Return true if widget box {x,y,width,height} would be outside grid.columns x grid.rows
    function out_of_grid(widget_coords, grid) {
        return widget_coords.x < 0 ||
               widget_coords.x + widget_coords.w > grid.columns ||
               widget_coords.y < 0 ||
               widget_coords.y + widget_coords.h > grid.rows;
    }

    // Add an existing (i.e. in layout_design.widgets) widget to the grid
    function add_existing_widget(x, y, width, height, widget_id, title, text) {

        // check widget lies within the grid, if not then ignore it
        if (out_of_grid({x:x,y:y,w:width,h:height}, layout_design.grid)) {
            //debug ijl20
            console.log('add_existing_widget() Grid '+layout_design.grid.columns+'x'+layout_design.grid.rows+
                        ' ignoring widget x:'+x+',y:'+y+',w:'+width+',h:'+height);
            return;
        }

        var new_widget = grid.addWidget(widget_el(widget_id, title, text),
                                        x,
                                        y,
                                        width,
                                        height,
                                        false,
                                        null,
                                        null,
                                        null,
                                        null,
                                        widget_id);
        setup_delete_button(new_widget);
        setup_edit_button(new_widget);
        // Draw tooltips (Material Design Lite handler)
        componentHandler.upgradeDom();
    }

    function submit_form_with_action(action, reload) {
        var form = $('#smartpanel-design-form');
        var save_button = $('#save');
        if (reload === true)
            form.attr('target','_blank');
        save_button.val(action);
        save_button.click();
        save_button.val('save');
        form.attr('target','_self');
    }

    // set the px width & height of the grid
    function reset_grid_size() {
        grid_container.height(grid_container.width() / layout_design.grid.ratio);
        grid.cellHeight(grid_container.height() / layout_design.grid.rows);
    }

    // On a window resize, call the grid-stack width() & height() methods to update grid
    $(window).resize(function() {
        reset_grid_size();
    });

    // Register 'onChange' handler for the grid size <select> element
    $('#layout_gridsize').change(function(e) {
        //debug ijl20
        console.log('layout_gridsize change');
        var gridsize = $('#layout_gridsize').val().split('x'); // e.g. "6x4" -> [6,4]
        // check all existing widgets for clash with new grid size
        for (var widget_id in layout_design.widgets) {
            if (!layout_design.widgets.hasOwnProperty(widget_id)) continue;
            var widget = layout_design.widgets[widget_id];
            if (out_of_grid(widget, { columns: gridsize[0], rows: gridsize[1] })) {
                // If we find *any* existing widget outside the new grid, we will prompt user ok to delete ?
                var ok_to_delete = confirm('Existing widgets are outside your new grid size ('+gridsize[0]+'x'+gridsize[1]+')!\n'+
                                           ' OK to DELETE those?');
                if (!ok_to_delete) {
                    // User hit 'cancel' on the "OK to delete" message, so do nothing and return, i.e. no change
                    // (because we got here via a 'select' dropdown, we have to reset that)
                    $('#layout_gridsize').val(layout_design.grid.columns + 'x' + layout_design.grid.rows);
                    return;
                }
                break;
            }
        }

        // At this point the user has either agreed to delete widgets outside the grid, or all widgets fit ok

        // set new grid size
        layout_design.grid.columns = gridsize[0];
        layout_design.grid.rows = gridsize[1];
        layout_design.grid.ratio = gridsize[0] >= gridsize[1] ? GRID_RATIO_LANDSCAPE : GRID_RATIO_PORTRAIT;

        //grid.setGridWidth( grid_columns, true ); // true == doNotPropagate i.e. not adjust widget widths
        grid.destroy();
        init(); // init will delete widgets that are outside the current grid
    });

    // Add onclick callback to the 'ADD WIDGET' button
    $('#add-widget').click(function(e) {
        e.preventDefault();
        // Use a 'default' size of 1x2 if grid has at least 4 rows and it'll fit
        if (layout_design.grid.rows >= 4 && grid.willItFit(null, null, 1, 2, true)) {
            add_new_widget(1,2);
        }
        // Otherwise try to add a 1x1 widget
        else if (grid.willItFit(null, null, 1, 1, true)) {
            add_new_widget(1,1);
        }
        else {
            alert('Not enough free space to place a new widget');
        }
    });

    // Send the complete configuration data back to tfc_web smartpanel.py/layout_config()
    $('#smartpanel-design-form').submit(function() {
        // Global var layout_design (created in layout_config.html) already contains the
        // { grid: {...}, widgets: { ..} } properties, but the x,y,w,h properties of each widget need updating before save.
        // Iterate each widget to fix up the x,y,w,h properties:
        $('.grid-stack > .grid-stack-item:visible').each(function() {
            var node = $(this).data('_gridstack_node');
            layout_design.widgets[node.id].x = node.x;
            layout_design.widgets[node.id].y = node.y;
            layout_design.widgets[node.id].w = node.width;
            layout_design.widgets[node.id].h = node.height;
        });

        // Embed this widget config in the submit form
        $('#design').val(JSON.stringify(layout_design));
    });

    $('#view-layout-and-save').click(function() {
        submit_form_with_action('view', true);
    });

    $('#update-display-submit').click(function() {
        submit_form_with_action('display', false);
    });

    // Useful utility ifunction to get nested object property or null if it doesn't exist
    // E.g. get_property_or_null(['a','b','c'], foo) will return foo.a.b.c or null
    function get_property_or_null(property_list, object) {
        return property_list.reduce((prefix, val) => (prefix && prefix[val]) ? prefix[val] : null, object);
    }

    // ***************************************************************
    // Initialize the grid. Called on page load or grid layout change
    // ***************************************************************
    function init() {
        // <div id="grid" class="grid grid-stack grid-stack-6">
        // </div>
        //

        if (layout_design.grid.columns > GRID_COLUMNS_MAX) {
            alert(layout_design.grid.columns+' is too many columns. Using '+GRID_COLUMNS_MAX+' (max columns in layout).');
            layout_design.grid.columns = 12;
        }

        // set page layout_gridsize and layout_orientation selects to match layout_design
        $('#layout_orientation').val(layout_design.grid.ratio < 1 ? 'portrait' : 'landscape');

        $('#layout_gridsize').val(layout_design.grid.columns+'x'+layout_design.grid.rows); // e.g. 6x4

        // Create class='grid-stack' element that gridstack will use
        $('.grid-container').append($('<div class="grid grid-stack grid-stack-'+layout_design.grid.columns+'"></div>'));

        // Initialize the class='grid-stack' element created above. Gridstack uses data- element properties to hold config.
        $('.grid-stack').gridstack({
            width: layout_design.grid.columns,
            height: layout_design.grid.rows,
            float: true,
            //cellHeight: 255,
            disableOneColumnMode: true,
            verticalMargin: 0,
            removable: true,
            resizable: {
                handles: 'n, ne, e, se, s, sw, w, nw'
            }
        });

        grid = $('.grid-stack').data('gridstack');

        next_widget_id = jQuery.isEmptyObject(layout_design.widgets) ? 0 :
                            Math.max.apply(null, Object.keys(layout_design.widgets).map(function(elem){ return parseInt(elem) })) + 1;

        // Any existing widget configs (i.e. on 'EDIT') are in 'layout_design.widgets' object set on layout_config.html template.
        // If layout_design.widgets = {} then just create a new unconfigured widget
        if (jQuery.isEmptyObject(layout_design.widgets)) {
            add_new_widget(1,2);
        } else {
            // We have pre-defined widget configs in the 'layout_design.widgets' object so layout those.
            Object.keys(layout_design.widgets).forEach(function(widget_id) {
                var widget = layout_design.widgets[widget_id];

                if (out_of_grid(widget, layout_design.grid)) {
                    //debug ijl20
                    console.log('init() deleting widget '+widget_id+' outside grid', widget);
                    delete layout_design.widgets[widget_id];
                } else {
                    add_existing_widget( widget.x,
                                     widget.y,
                                     widget.w,
                                     widget.h,
                                     widget_id,
                                     get_property_or_null(['placeholder', 'title'], widget),
                                     get_property_or_null(['placeholder', 'text'], widget));
                }
            });
        }

        // set the px width, height of the grid
        reset_grid_size();
    }

    // *******************************************************************************************
    // PAGE LOAD INIT CODE
    // *******************************************************************************************

    grid_container = $('.grid-container');

    // Fixup layout_design to have list of widgets in 'widgets' property
    // For a new layout, layout_design = {}
    // For a prior version layout, layout_design = { '0': {widget info}, '1': { widget info } ... }
    // For the current version, layout_design = { grid: { grid info }, widgets: { widget list as above }}
    // This code normalizes layout_design to current version
    if ( jQuery.isEmptyObject(layout_design) ||  !(layout_design.hasOwnProperty('widgets')) ) {
        // note we have to CLONE layout_design into new_design for correct copy.
        var new_design = { grid: { rows: GRID_ROWS_DEFAULT,
                                   columns: GRID_COLUMNS_DEFAULT,
                                   ratio: GRID_RATIO_DEFAULT
                                 },
                           widgets: JSON.parse(JSON.stringify(layout_design))
                         };
        layout_design = new_design;
    }

    // At this point the layout_design variable, created in 'layout_config.html', is ensured to
    // have the structure { grid: { rows: ,columns:, ratio: }, widgets: { widget list } }
    // where 'widget list' is { '0': { widget params }, '1': { widget params } ...
    // but the integer properties (actually widget_id) need not be contiguous numbers.
    init();

    // ******************************************************************************
    // WIDGET CONFIGURATION
    // ******************************************************************************

    var active_widget_id;

    function functionalise(str) {
        var frags = str.split('_');
        for (var i=0; i<frags.length; i++) {
            frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
        }
        return frags.join('');
    }

    $("#widget-selector").change(function (e) {
        var widget_name = $(this).val();
        // Initialise the Widget passing widget_id
        var widget = new window[functionalise(widget_name)](active_widget_id);
        var params = {};
        if (Object.keys(layout_design.widgets).indexOf(active_widget_id) > -1)
            params = layout_design.widgets[active_widget_id]['data'];
        // Call widget configuration script with config and preexisting params (if any).
        // It will return a dictionary with three functions:
        // valid() [to validate the form], value() [to retrieve the data from the form],
        // and config() [to show data in the config square]
        var widget_conf = widget.configure(
            {
                'container_id': 'configuration-widget-form',
                'static_url': widget_location
            },
            params);
        var save_button = document.getElementById('configuration-widget-save-button');
        $.data( save_button, "widget_id", active_widget_id );
        $.data( save_button, "widget_name", widget_name );
        $.data( save_button, "valid", widget_conf.valid );
        $.data( save_button, "config", widget_conf.config );
        $.data( save_button, "value", widget_conf.value );

        // ENTER key in input fields in the configuration form should be save not cancel
        $("#configuration-widget-form input").on("keypress", function(e) {
            /* ENTER key */
            if (e.keyCode === 13) {
                e.preventDefault();
                $('#configuration-widget-save-button').trigger("click");
            }
        });
    });

    $('#configuration-widget-save-button').click(function() {
        var save_button = $(this);
        if (save_button.data("valid")() === true) {
            $("#overlay-configure-widget").hide();
            $('body').css('overflow','auto');
            $("#configuration-widget-form").empty();
            var placeholder = save_button.data("config")();
            layout_design.widgets[save_button.data("widget_id")] = {
                "widget": save_button.data("widget_name"),
                "data": save_button.data("value")(),
                "placeholder": placeholder
            };
            // Retrieve the widget conf space to replace it with the results from the widget conf
            $("#widget-"+save_button.data("widget_id")+" h1").text(placeholder.title);
            $("#widget-"+save_button.data("widget_id")+" p").text(placeholder.text);
        }
    });

    $('#configuration-widget-cancel-button').click(function() {
        $("#overlay-configure-widget").hide();
        $('body').css('overflow','auto');
        $("#configuration-widget-form").empty();
        $("#widget-selector").prop('selectedIndex', 0);
    });

});

