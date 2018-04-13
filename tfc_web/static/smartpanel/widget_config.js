

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
    function config_input(parent_el, param_type, param_options, param_current) {
        //self.log('creating input', param_name, param_type, param_options, param_current);
        var input_info = {}; // info to return, .value() = data callback
        switch (param_type) {
            case 'select':
                input_info.value = config_select(parent_el, param_options, param_current);
                break;

            case 'string':
                input_info.value = config_string(parent_el, param_options, param_current);
                break;

            case 'number':
                input_info.value = config_number(parent_el, param_options, param_current);
                break;

            default:
                input_info = null;
                //self.log(widget_id, 'bad param_type in config_input', param_type);
        }

        return input_info;
    }

    // Append a row containing <td>TITLE</td><td>SELECT</td>
    function config_select(parent_el, param_options, param_current) {
        //self.log('creating select element', param_name, 'with', param_current);
        //var id = config_id + '_' + param_name;
        var row = document.createElement('tr');

        // create td to hold 'name' prompt for field
        var name = document.createElement('td');
        name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = param_options.title;
        label.appendChild(document.createTextNode(param_options.text));
        name.appendChild(label);
        row.appendChild(name);
        var value = document.createElement('td');
        value.className = 'config_property_value';
        var sel = document.createElement('select');

        // set select.title
        if (param_options.title) sel.title = param_options.title;

        // set select.onchange
        if (param_options.onchange) {
            console.log('config_select: setting onchange');
            sel.onchange = function () { param_options.onchange({ value: this.value,
                                                                  parent: parent_el
                                                                }); } ;
        }

        // set the select dropdown options
        var select_options = param_options.options;
        for (var i=0; i<select_options.length; i++) {
            var opt = document.createElement('option');
            opt.value = select_options[i].value;
            opt.text = select_options[i].text;
            sel.appendChild(opt);
        }

        // set default value of input to value provided in param_current
        if (param_current) sel.value = param_current;

        value.appendChild(sel);
        row.appendChild(value);
        parent_el.appendChild(row);

        return function () { return sel.value; };
    }

    function config_number(parent_el, param_options, param_current) {
        if (!param_options.type) param_options.type = 'number';
        return config_string(parent_el, param_options, param_current);
    }

    //  Append a table row with a simple input field
    function config_string(parent_el, param_options, param_current)
    {
        var row = document.createElement('tr');
        // create td to hold 'name' prompt for field
        var td_name = document.createElement('td');
        td_name.className = 'config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = param_options.title;
        label.appendChild(document.createTextNode(param_options.text));
        td_name.appendChild(label);
        row.appendChild(td_name);
        var td_value = document.createElement('td');
        td_value.className = 'config_property_value';

        var input = document.createElement('input');

        if (param_options.type) input.type = param_options.type;
        if (param_options.step) input.step = param_options.step;
        if (param_options.title) input.title = param_options.title;

        // set default value of input to value provided in param_current
        //self.log(param_name,'default set to',param_current);
        if (param_current) input.value = param_current;

        td_value.appendChild(input);
        row.appendChild(td_value);

        parent_el.appendChild(row);

        return function() { return input.value; };
    }

    // A shim function to provide the 'config cancel' in the active layout
    function config_shim_cancel(self, config) {
        // reset original widget background-color to WHITE
        var widget = document.getElementById(config.widget_id);
        if (widget) widget.style['background-color'] = 'white';

        // hide the config div
        var config_div = document.getElementById(config.config_id);
        config_div.style.display = 'none';

        self.log(config.config_id, 'cancel button');
    }

    // A shim function to provide the 'config save' in the active layout
    function config_shim_save(self, config, config_params) {
        // Here we update the existing widget 'in-place', not expected in production

        self.params = config_params; //self.params = config_params;

        self.log(config.widget_id,'config reset params to',self.params);//self.params);

        var widget = document.getElementById(config.widget_id);

        // reset original widget background-color to WHITE
        widget.style['background-color'] = 'white';

        // hide the config div
        var config_div = document.getElementById(config.config_id);
        config_div.style.display = 'none';

        self.init();
    }

