// ************************************************************************************
// *****************  Library Widget Configuration ************************************
// ************************************************************************************
//
// THESE ARE GENERAL PURPOSE CONFIG INPUT FUNCTIONS, should be in common widget.js
//
// config_input will append a <tr> to the parent object 'parent_el'
// and add an entry to the global dictionary:
// config_inputs[param_name] = { type: param_type,
//                               options: param_options,
//                               value: a function that returns the value }
//
// config_input(
//   parent_el:     DOM object to append input element (tbody)
//   param_name:    property name for widget, e.g. 'station'.
//   param_type:    'select' | 'string' | 'number'
//   param_options: options needed for each input type
//   param_current: current value of property (for edit)
//   )
// 'select': { text: text display before dropdown
//             title: helper text
//             options: [ { value: <key>, text: <displayname> } ... ]
//            }
//
// 'string':  { text:
//              title:
//            });
//
// 'number':  { text:
//              title:
//              step: 'any' *[OPTIONAL]
//            });
function config_input(parent_el, param_name, param_type, param_options, param_current) {
    self.log('creating input', param_name, param_type, param_options, param_current);
    config_inputs[param_name] = {};
    config_inputs[param_name].type = param_type;
    config_inputs[param_name].options = param_options;
    switch (param_type) {
        case 'select':
            parent_el.appendChild(config_select(param_name, param_options, param_current));
            break;

        case 'string':
            parent_el.appendChild(config_string(param_name, param_options, param_current));
            break;

        case 'number':
            parent_el.appendChild(config_number(param_name, param_options, param_current));
            break;

        default:
            self.log(widget_id, 'bad param_type in config_input', param_type);
    }

    return null;
}

function config_select(param_name, options, param_current) {
    self.log('creating select element', param_name, 'with', param_current);
    var id = config_id + '_' + param_name;
    var row = document.createElement('tr');

    // create td to hold 'name' prompt for field
    var name = document.createElement('td');
    name.class = 'config_property_name';
    var label = document.createElement('label');
    label.for = id;
    label.title = options.title;
    label.appendChild(document.createTextNode(options.text));
    name.appendChild(label);
    row.appendChild(name);
    var value = document.createElement('td');
    value.class = 'config_property_value';
    var sel = document.createElement('select');
    if (options.title) sel.title = options.title;
    sel.id = id;
    var select_options = options.options;
    for (var i=0; i<select_options.length; i++) {
        var opt = document.createElement('option');
        opt.value = select_options[i].value;
        opt.text = select_options[i].text;
        sel.appendChild(opt);
    }
    // set default value of input to value provided in param_current
    if (param_current) sel.value = param_current;
    config_inputs[param_name].element = sel; // add input element to global dict for Save
    config_inputs[param_name].value = function () { return sel.value; };
    value.appendChild(sel);
    row.appendChild(value);

    return row;
}

function config_number(param_name, param_options, param_current) {
    if (!param_options.type) param_options.type = 'number';
    return config_string(param_name, param_options, param_current);
}

// Return a table row with a simple input field
function config_string(param_name, options, param_current)
{
    var id = config_id + '_' + param_name;
    var row = document.createElement('tr');
    // create td to hold 'name' prompt for field
    var name = document.createElement('td');
    name.class = 'config_property_name';
    var label = document.createElement('label');
    label.for = id;
    label.title = options.title;
    label.appendChild(document.createTextNode(options.text));
    name.appendChild(label);
    row.appendChild(name);
    var value = document.createElement('td');
    value.class = 'config_property_value';

    var input = document.createElement('input');
    input.id = id;
    if (options.type) input.type = options.type;
    if (options.step) input.step = options.step;
    if (options.title) input.title = options.title;

    // set default value of input to value provided in param_current
    self.log(param_name,'default set to',param_current);
    if (param_current) input.value = param_current;

    config_inputs[param_name].element = input;
    config_inputs[param_name].value = function() { return input.value; };
    value.appendChild(input);
    row.appendChild(value);

    return row;
}

// A 'shim' callback for the configuration results
function config_shim_callback(config_params) {
    if (config_params) {
        config_shim_save(config_params);
    } else {
        config_shim_cancel();
    }
}

// A shim function to provide the 'config cancel' in the active layout
function config_shim_cancel() {
    // **                                                         **
    // reset original widget background-color to WHITE
    var widget = document.getElementById(widget_id);
    if (widget) widget.style['background-color'] = 'white';

    // hide the config div
    var config = document.getElementById(config_id);
    config.style.display = 'none';
    // **                                                         **
    // *************************************************************

    self.log(config_id, 'cancel button');
}

// A shim function to provide the 'config save' in the active layout
function config_shim_save(config_params) {
    // Here we update the existing widget 'in-place', not expected in production

    params = config_params; //self.params = config_params;

    self.log(widget_id,'config reset params to',params);//self.params);

    var widget = document.getElementById(widget_id);

    // reset original widget background-color to WHITE
    widget.style['background-color'] = 'white';

    // hide the config div
    var config = document.getElementById(config_id);
    config.style.display = 'none';

    self.init();
}


