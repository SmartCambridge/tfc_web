var defaultGrid = {
    '0': {w: 2, h: 2, x: 0, y: 0},
    '1': {w: 2, h: 2, x: 2, y: 0},
    '2': {w: 2, h: 2, x: 0, y: 2}
};

var nboxes = Object.keys(defaultGrid).length;


function createGrid() {
    $('#grid').gridList({
        lanes: SmartCamGrid.currentSize,
        direction: SmartCamGrid.direction,
        widthHeightRatio: SmartCamGrid.widthHeightRatio,
        heightToFontSizeRatio: SmartCamGrid.heightToFontSizeRatio
    });
}


function assing_resize_binding() {
    $('#grid li .resize').click(function (e) {
        e.preventDefault();
        $(e.currentTarget).closest('div').children().removeClass('selected');
        $(e.currentTarget).addClass('selected');
        var itemElement = $(e.currentTarget).closest('li'),
            itemWidth = $(e.currentTarget).data('w'),
            itemHeight = $(e.currentTarget).data('h');
        itemElement.attr('data-w', itemWidth);
        itemElement.attr('data-h', itemHeight);
        $('#grid').gridList('resizeItem', itemElement, {
            w: itemWidth,
            h: itemHeight
        });
    });
    $('#grid li .delete').click(function (e) {
        e.preventDefault();
        if ($(e.currentTarget).data('del') == true) {
            $(e.currentTarget).closest('li').remove();
        }
    });
}

function box_html(box_content) {
    return '<li>' +
        '<div class="inner">' +
        '<div class="controls">' +
        '<a href="#" class="selected resize mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-w="2" data-h="2">2x2</a>' +
        '<a href="#" class="resize mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-w="2" data-h="4">2x4</a>' +
        '<a href="#" class="resize mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-w="4" data-h="2">4x2</a>' +
        '<a href="#" class="resize mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-w="4" data-h="4">4x4</a>' +
        '<a href="#" class="resize mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-w="2" data-h="6">2x6</a>' +
        '<a href="#" class="resize mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-w="6" data-h="2">6x2</a>' +
        '<a href="#" class="delete mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored" data-del="true">del</a>' +
        '</div>' +
        box_content +
        '</div>' +
        '</li>'
}

var SmartCamGrid = {
    currentSize: 6,
    direction: 'vertical',
    widthHeightRatio: 16 / 9,
    heightToFontSizeRatio: 0.25,
    buildElements: function ($gridContainer, dict) {
        Object.keys(dict).forEach(function(key) {
            var item = dict[key];
            $item = $(box_html(key));
            $item.attr({
                'data-w': item.w,
                'data-h': item.h,
                'data-x': item.x,
                'data-y': item.y
            });
            $gridContainer.append($item);
        });
    },
    appendElement: function ($gridContainer, item) {
        $item = $(box_html(nboxes));
        nboxes += 1;
        $item.attr({
            'data-w': item.w,
            'data-h': item.h,
            'data-x': item.x,
            'data-y': item.y
        });
        $gridContainer.append($item);
        createGrid();
        assing_resize_binding();
    }
};


$(window).resize(function () {
    $('#grid').gridList('reflow');
});

$.urlParam = function (name) {
    var results = new RegExp('[\?&]' + name + '=([^]*)').exec(window.location.href);
    if (results == null) {
        return null;
    }
    else {
        return results[1] || 0;
    }
};

$(function () {
    var grid = $('#grid');

    if ($.urlParam('grid') === null) {
        SmartCamGrid.buildElements($('#grid'), defaultGrid);
    } else {
        defaultGridParams = JSON.parse(decodeURIComponent($.urlParam("grid")));
        nboxes = Object.keys(defaultGridParams).length;
        SmartCamGrid.buildElements($('#grid'), defaultGridParams);
    }

    grid.gridList({
        lanes: SmartCamGrid.currentSize,
        direction: SmartCamGrid.direction,
        widthHeightRatio: SmartCamGrid.widthHeightRatio,
        heightToFontSizeRatio: SmartCamGrid.heightToFontSizeRatio
    });

    createGrid();
    assing_resize_binding();

    $('#add-widget').click(function (e) {
        e.preventDefault();
        SmartCamGrid.appendElement(grid, {w: 2, h: 2, x: 0, y: 0});
        grid.gridList('resize', SmartCamGrid.currentSize); // refresh the grid to reallocate spaces
    });

    $('#dashboard-design-form').submit(function (e) {
        var grid_items = $.extend({}, $("#grid").data('_gridList').gridList.items);
        for (i = 0; i < Object.keys(grid_items).length; i++) {
            delete grid_items[i].$element;
            delete grid_items[i].id;
            delete grid_items[i].autoSize;
        }
        $('input[name=design]').val(JSON.stringify(grid_items));
    });
});
