document.addEventListener('init', function(event) {
  var page = event.target;

  if (page.id === 'first') {
    page.querySelector('#accept').addEventListener('click', function() {
      document.querySelector('#myNavigator').pushPage('panels.html');
    });
  }

  else if (page.id === 'panels') {
    page.querySelector('#new').addEventListener('click', function() {
      document.querySelector('#myNavigator').pushPage('config.html');
    });
    page.querySelectorAll('ons-list-item').forEach(function(item) {
    	item.addEventListener('click', function() {
          document.querySelector('#myNavigator').pushPage('panel.html');
        });
    });
  }

});
