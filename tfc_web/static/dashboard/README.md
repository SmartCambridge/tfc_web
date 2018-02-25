# SmartCambridge Dashboard Framework

This directory contains the list of widgets for the SmartCambridge Dashboard Framework (aka Lobby Panel screens).

## Installation of new widgets

To install a new widget just copy and paste the widget folder inside this folder. The Dashboard Framework will
automatically recognise it and it will be ready to use. You will have to redeploy tfc_web and execute collectstatic.

## Widget requirements

There are some requirements that the widgets need to follow in order to work with the SmartCambridge Dashboard 
Framework:

 - Each widget has to have a unique_name that is used as the folder name, the js file name, and the schema.json 
 file name. The unique_name should be short and not contain spaces. For example, for the widget with name 
 "widget_foo", the directory structure will be:
    - widget_foo
        - widget_foo.js
        - widget_foo_schema.json
        - widget_foo.css
        - README.md
 - The Dashboard Framework will load the json shchema file (for example, for widget "unique_name" this will be 
 "unique_name_schema.json") when the user wants to configure the widget. 
 Therefore, the schema json file should contain a json_schema definition of all fields that are needed to configure
 the widget. The Dashboard Framework will auto-generate a web form with these fields that will allow the user to
 configure the widget parameters. Do not forget to include "title" property inside the json schema of the widget 
 as this will be used as the user readable version of the name of the widget.
 - Once the user has configured the widget and has filled in all the required parameters, these will be used to
 initialise the widget inside the dashboard once it gets loaded. 
 - The only library that the dashboard will load will be "unique_name.js" and it will call the init function from this
 file passing the parameters filled in from the user with the configuration based on the widget json schema.
 - The js library will have to contain a function named as the widget but capitalised. For example, if the widget
 is called "unique_name", the function should be called "UniqueName". This class will be initialised with two
 parameters:
    - container: the id of the DOM element where the widget will be loaded
    - params: the list of required parameters (in dict/json format) to initialise the widget.
    - static_files_url: the URL of the widgets. This is passed to the widget function so that it can help them to load
    dependencies.
 - The function with name "UniqueName" should contain a subfunction called init() that will be called once the DOM 
 is ready and all the widgets have been initialise.
 - The previous functions will have to load all the required dependencies of the widget (js libraries, css, etc), as
 the Dashboard only loads the main library js file and the json schema.
