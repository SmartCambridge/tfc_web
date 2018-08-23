

// JS code for layout_config
//
// Is loaded by the smartpanel template layout_config.html
//
// Note the layout_config.html template initializes the global var "layout_design" to contain the current config JSON,
// which has been loaded from the Django layouts table.  This config can be viewed easily via the 'Export' button.
//
// This code uses the gridstack.js library https://github.com/gridstack/gridstack.js/tree/develop/doc
//
$(function () {

    var PANEL_WIDTH = 1920;        // Target screensize is 1920 x 1080
    var PANEL_HEIGHT = 1080;
    var PANEL_HEADER_HEIGHT = 60;  // Assume clock/logo header is 60px

    var GRID_RATIO_LANDSCAPE = PANEL_WIDTH / (PANEL_HEIGHT - PANEL_HEADER_HEIGHT);
    var GRID_RATIO_PORTRAIT = PANEL_HEIGHT / (PANEL_WIDTH - PANEL_HEADER_HEIGHT);

    // *******************************************************************************************
    // GLOBALS
    // *******************************************************************************************
    var grid_columns;          // grid layout of SmartPanel is GRID_COLUMNS x GRID_ROWS
    var grid_rows;

    var grid_ratio;

    var grid_container;

    var grid;

    var next_widget_id;

    // *******************************************************************************************
    // FUNCTIONS
    // *******************************************************************************************
    const idx = (props, object) => props.reduce((prefix, val) => (prefix && prefix[val]) ? prefix[val] : null, object);

    function widget_el(id, title, text) {
        if( typeof title == 'undefined' || title === null ) {
            title = "Click configure button"
        }
        if( typeof text == 'undefined' || text === null ) {
            text = ""
        }
        return $(
            '<div><div id="section-'+id+'" class="grid-stack-item-content">\n' +
            '    <div style="width: 100%; text-align: center; padding-top: 10px; padding-bottom: 10px">\n' +
            '        <a id="edit-widget-button-'+id+'" class="edit-widget mdl-button mdl-js-button ' +
            'mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-widget-id="'+id+'" >\n' +
            '            <i class="material-icons">build</i></a>\n' +
            '        <div class="mdl-tooltip" data-mdl-for="edit-widget-button-'+id+'">Configure widget</div>\n' +
            '        <a id="delete-widget-button-'+id+'" class="delete-widget mdl-button mdl-js-button ' +
            'mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-widget-id="'+id+'" >\n' +
            '            <i class="material-icons">delete</i></a>\n' +
            '        <div class="mdl-tooltip" data-mdl-for="delete-widget-button-'+id+'">Delete widget</div>\n' +
            '    </div>\n' +
            '    <div id="widget-'+id+'" class="widget-configured-text"><h1>'+title+'</h1><p>'+text+'</p></div>\n' +
            '</div></div>')
    }

    function setup_delete_button(widget) {
        widget.find('.delete-widget').click(function (e) {
            e.preventDefault();
            var widget_id = $(e.currentTarget).data('widget-id').toString();
            delete layout_design[widget_id];
            grid.removeWidget($("#section-"+widget_id).parent());
        });
    }

    function setup_edit_button(widget) {
        widget.find('.edit-widget').click(function (e) {
            active_widget_id = $(e.currentTarget).data('widget-id').toString();
            // We check if the widget has already a configuration
            if (Object.keys(layout_design).indexOf(active_widget_id) > -1)
                $("#widget-selector").val(layout_design[active_widget_id]['widget']).trigger("change");
            else
                $("#widget-selector").prop('selectedIndex', 0);
            $('#overlay-configure-widget').css( "display", "flex" );
            $('body').css('overflow','hidden');
        });
    }

    function add_new_widget(width,height) {
        new_widget = grid.addWidget(widget_el(next_widget_id, null, null),
            null, null, width, height, true, null, null, null, null, next_widget_id);
        setup_delete_button(new_widget);
        setup_edit_button(new_widget);
        // Draw tooltips
        componentHandler.upgradeDom();
        next_widget_id += 1;
    }

    function add_existing_widget(x, y, width, height, id, title, text) {
        new_widget = grid.addWidget(widget_el(id, title, text),
            x, y, width, height, false, null, null, null, null, id);
        setup_delete_button(new_widget);
        setup_edit_button(new_widget);
        // Draw tooltips
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
        grid_container.height(grid_container.width() / grid_ratio);
        grid.cellHeight(grid_container.height() / grid_rows);
    }

    // On a window resize, call the grid-stack width() & height() methods to update grid
    $(window).resize(function() {
        reset_grid_size();
    });


    // Register 'onChange' handler for the layout_orientation <select> element.
    // Will return landscape | portrait
    $('#layout_orientation').change(function(e) {
        switch ($('#layout_orientation').val()) {
            case 'landscape':
                grid_ratio = GRID_RATIO_LANDSCAPE;
                reset_grid_size();
                break;

            case 'portrait':
                grid_ratio = GRID_RATIO_PORTRAIT;
                reset_grid_size();
                break;

            default:
        }
    });

    $('#layout_gridsize').change(function(e) {
        var gridsize = JSON.parse($('#layout_gridsize').val());
        grid_columns = gridsize.grid_columns;
        grid_rows = gridsize.grid_rows;
        //alert('layout_gridsize '+gridsize.grid_columns+'x'+gridsize.grid_rows);
        //grid.setGridWidth( grid_columns, true ); // true == doNotPropagate i.e. not adjust widget widths
        grid.destroy();
        init();
    });

    // Add onclick callback to the 'ADD WIDGET' button
    $('#add-widget').click(function(e) {
        e.preventDefault();
        // Use a 'default' size of 1x2 if grid has at least 4 rows and it'll fit
        if (grid_rows >= 4 && grid.willItFit(null, null, 1, 2, true)) {
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
        // Iterate each widget to fix up the x,y,w,h properties
        $('.grid-stack > .grid-stack-item:visible').each(function() {
            var node = $(this).data('_gridstack_node');
            layout_design[node.id].x = node.x;
            layout_design[node.id].y = node.y;
            layout_design[node.id].w = node.width;
            layout_design[node.id].h = node.height;
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

    function init() {
        // <div id="grid" class="grid grid-stack grid-stack-6">
        // </div>
        //
        $('.grid-container').append($('<div class="grid grid-stack grid-stack-'+grid_columns+'"></div>'));

        $('.grid-stack').gridstack({
            width: grid_columns,
            height: grid_rows,
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

        next_widget_id = jQuery.isEmptyObject(layout_design) ? 0 :
                            Math.max.apply(null, Object.keys(layout_design).map(function(elem){ return parseInt(elem) })) + 1;

        console.log('grid rows',grid_rows);

        // Any existing widget configs (i.e. on 'EDIT') are in 'layout_design' object set on layout_config.html template.
        // If layout_design = {} then just create a new unconfigured widget
        if (jQuery.isEmptyObject(layout_design)) {
            add_new_widget(1,2);
        } else {
            // We have pre-defined widget configs in the 'layout_design' object so layout those.
            Object.keys(layout_design).forEach(function(key) {
                add_existing_widget( layout_design[key]['x'],
                                     layout_design[key]['y'],
                                     layout_design[key]['w'],
                                     layout_design[key]['h'],
                                     key,
                                     idx(['placeholder', 'title'], layout_design[key]),
                                     idx(['placeholder', 'text'], layout_design[key]))
            });
        }

        // set the px width, height of the grid
        reset_grid_size();
    }

    // *******************************************************************************************
    // INIT CODE
    // *******************************************************************************************

    grid_columns = 6;          // grid layout of SmartPanel is GRID_COLUMNS x GRID_ROWS
    grid_rows = 4;
    // The current assumed ratio of height/width for the display. User can change this from "layout_orientation" <select>
    grid_ratio = GRID_RATIO_LANDSCAPE;

    grid_container = $('.grid-container');

    init();

    // ******************************************************************************
    // WIDGET CONFIGURATION
    // ******************************************************************************

    var active_widget_id;

    function functionalise(str) {
        frags = str.split('_');
        for (i=0; i<frags.length; i++) {
            frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
        }
        return frags.join('');
    }

    $("#widget-selector").change(function (e) {
        var widget_name = $(this).val();
        // Initialise the Widget passing widget_id
        var widget = new window[functionalise(widget_name)](active_widget_id);
        var params = {};
        if (Object.keys(layout_design).indexOf(active_widget_id) > -1)
            params = layout_design[active_widget_id]['data'];
        // Call widget configuration script with config and preexisting params (if any).
        // It will return a dictionary with three functions:
        // valid() [to validate the form], value() [to retrieve the data from the form],
        // and config() [to show data in the config square]
        widget_conf = widget.configure(
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
            layout_design[save_button.data("widget_id")] = {
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

