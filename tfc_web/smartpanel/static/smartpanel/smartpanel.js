
$(function () {
    const idx = (props, object) => props.reduce((prefix, val) => (prefix && prefix[val]) ? prefix[val] : null, object);

    var nboxes = Math.max.apply(null, Object.keys(defaultGrid).map(function(elem){ return parseInt(elem) })) + 1;

    $('.grid-stack').gridstack({
        width: 6,
        height: 4,
        float: true,
        cellHeight: 255,
        disableOneColumnMode: true,
        verticalMargin: 0,
        removable: true,
        resizable: {
            handles: 'n, ne, e, se, s, sw, w, nw'
        }
    });
    var grid = $('.grid-stack').data('gridstack');

    function widget_el(id, title, text) {
        if( typeof title == 'undefined' || title === null ) {
            title = "Widget unconfigured, click configure button to configure it"
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
            delete data[widget_id];
            grid.removeWidget($("#section-"+widget_id).parent());
        });
    }

    function setup_edit_button(widget) {
        widget.find('.edit-widget').click(function (e) {
            active_widget_id = $(e.currentTarget).data('widget-id').toString();
            // We check if the widget has already a configuration
            if (Object.keys(data).indexOf(active_widget_id) > -1)
                $("#widget-selector").val(data[active_widget_id]['widget']).trigger("change");
            else
                $("#widget-selector").prop('selectedIndex', 0);
            $('#overlay-configure-widget').css( "display", "flex" );
            $('body').css('overflow','hidden');
        });
    }

    function add_new_widget() {
        new_widget = grid.addWidget(widget_el(nboxes, null, null),
            null, null, 1, 1, true, null, null, null, null, nboxes);
        setup_delete_button(new_widget);
        setup_edit_button(new_widget);
        // Draw tooltips
        componentHandler.upgradeDom();
        nboxes += 1;
    }

    function add_existing_widget(x, y, width, height, id, title, text) {
        new_widget = grid.addWidget(widget_el(id, title, text),
            x, y, width, height, false, null, null, null, null, id);
        setup_delete_button(new_widget);
        setup_edit_button(new_widget);
        // Draw tooltips
        componentHandler.upgradeDom();
    }

    Object.keys(defaultGrid).forEach(function(key) {
        add_existing_widget(defaultGrid[key]['x'], defaultGrid[key]['y'],
            defaultGrid[key]['w'], defaultGrid[key]['h'], key, idx(['placeholder', 'title'], defaultGrid[key]),
            idx(['placeholder', 'text'], defaultGrid[key]))
    });

    var grid_container = $('.grid-container');
    grid_container.height(grid_container.width()*9/16);
    grid.cellHeight(grid_container.height()/4);

    $(window).resize(function() {
        grid_container.height(grid_container.width()*9/16);
        grid.cellHeight(grid_container.height()/4);
    });

    $('#add-widget').click(function(e) {
        e.preventDefault();
        if (grid.willItFit(null, null, 1, 1, true)) {
            add_new_widget();
        }
        else {
            alert('Not enough free space to place a new widget');
        }
    });

    $('#smartpanel-design-form').submit(function() {
        var serializedData = {};
        $('.grid-stack > .grid-stack-item:visible').each(function() {
            var node = $(this).data('_gridstack_node');
            serializedData[node.id] = {
                x: node.x,
                y: node.y,
                w: node.width,
                h: node.height
            };
        });
        $('input[name=design]').val(JSON.stringify(serializedData));
        $('#form-data').val(JSON.stringify(data));
    });

    // WIDGET CONFIGURATION

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
        if (Object.keys(data).indexOf(active_widget_id) > -1)
            params = data[active_widget_id]['data'];
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
            data[save_button.data("widget_id")] = {
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

    $('#view-layout-and-save').click(function() {
        submit_form_with_action('view', true);
    });

    $('#update-display-submit').click(function() {
        submit_form_with_action('display', false);
    });
});
