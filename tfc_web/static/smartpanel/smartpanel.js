
$(function () {
    
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

    function widget_el(id) {
        return $('<div><div class="grid-stack-item-content"><a class="delete-widget mdl-button mdl-js-button ' +
            'mdl-button--raised mdl-js-ripple-effect mdl-button--colored">delete widget</a>' +
            '<p class="widget_id_p">'+id+'</p></div></div>')
    }

    function add_new_widget() {
        new_widget = grid.addWidget(widget_el(nboxes),
            null, null, 1, 1, true, null, null, null, null, nboxes);
        nboxes += 1;
        new_widget.find('.delete-widget').click(function (e) {
            e.preventDefault();
            grid.removeWidget($(this).parent().parent());
        });
    }

    function add_existing_widget(x, y, width, height, id) {
        new_widget = grid.addWidget(widget_el(id),
            x, y, width, height, false, null, null, null, null, id);
        new_widget.find('.delete-widget').click(function (e) {
            e.preventDefault();
            grid.removeWidget($(this).parent().parent());
        });
    }

    Object.keys(defaultGrid).forEach(function(key) {
        add_existing_widget(defaultGrid[key]['x'], defaultGrid[key]['y'],
            defaultGrid[key]['w'], defaultGrid[key]['h'], key)
    });

    $('#add-widget').click(function (e) {
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
    });
});
