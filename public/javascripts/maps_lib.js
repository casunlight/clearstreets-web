/*!
 * Searchable Map Template with Google Fusion Tables
 * http://derekeder.com/searchable_map_template/
 *
 * Copyright 2012, Derek Eder
 * Licensed under the MIT license.
 * https://github.com/derekeder/FusionTable-Map-Template/wiki/License
 *
 * Date: 12/10/2012
 * 
 */
 
var MapsLib = MapsLib || {};
var MapsLib = {
  
  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info
  
  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId:      "", //handled by Storm select dropdown
  
  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/   
  //*Important* this key is for demonstration purposes. please register your own.   
  googleApiKey:       "AIzaSyDLk_OnxnJyIyXkjQ4I4NGPEnh39ibzE7A",    //chicago.plow.tracker@gmail.com    
  
  //name of the location column in your Fusion Table. 
  //NOTE: if your location column name has spaces in it, surround it with single quotes 
  //example: locationColumn:     "'my location'",
  locationColumn:     "geometry",  

  map_centroid:       new google.maps.LatLng(41.8781136, -87.66677856445312), //center that your map defaults to
  locationScope:      "chicago",      //geographical area appended to all address searches
  recordName:         "result",       //for showing number of results
  recordNamePlural:   "results", 
  
  searchRadius:       805,            //in meters ~ 1/2 mile
  defaultZoom:        13,             //zoom level when map is loaded (bigger is more zoomed in)
  addrMarkerImage: 'http://derekeder.com/images/icons/blue-pushpin.png',
  currentPinpoint: null,
  
  initialize: function() {
    $( "#result_count" ).html("");
  
    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          stylers: [
            { saturation: -100 },
            { lightness: 40 }
          ]
        }
      ]
    };
    map = new google.maps.Map($("#map_canvas")[0],myOptions);
    
    MapsLib.searchrecords = null;
    
    //reset filters
    $("#search_address").val(MapsLib.convertToPlainString($.address.parameter('address')));
    var loadRadius = MapsLib.convertToPlainString($.address.parameter('radius'));
    if (loadRadius != "") $("#search_radius").val(loadRadius);
    else $("#search_radius").val(MapsLib.searchRadius);
    $(":checkbox").attr("checked", "checked");
    $("#result_count").hide();
     
    //run the default search
    MapsLib.doSearch();
    MapsLib.getLastUpdated();
    //MapsLib.getActivePlows();
  },
  
  doSearch: function(location) {
    MapsLib.clearSearch();
    var address = $("#search_address").val();
    MapsLib.searchRadius = $("#search_radius").val();

    var whereClause = MapsLib.locationColumn + " not equal to ''";
    
    //-----custom filters-------
    MapsLib.fusionTableId = $("#select_storm").val();
    //-------end of custom filters--------
    
    if (address != "") {
      if (address.toLowerCase().indexOf(MapsLib.locationScope) == -1)
        address = address + " " + MapsLib.locationScope;
  
      geocoder.geocode( { 'address': address}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          MapsLib.currentPinpoint = results[0].geometry.location;
          
          $.address.parameter('address', encodeURIComponent(address));
          $.address.parameter('radius', encodeURIComponent(MapsLib.searchRadius));
          map.setCenter(MapsLib.currentPinpoint);
          map.setZoom(14);
          
          MapsLib.addrMarker = new google.maps.Marker({
            position: MapsLib.currentPinpoint, 
            map: map, 
            icon: MapsLib.addrMarkerImage,
            animation: google.maps.Animation.DROP,
            title:address
          });
          
          whereClause += " AND ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";
          
          MapsLib.drawSearchRadiusCircle(MapsLib.currentPinpoint);
          MapsLib.submitSearch(whereClause, map, MapsLib.currentPinpoint);
        } 
        else {
          alert("We could not find your address: " + status);
        }
      });
    }
    else { //search without geocoding callback
      MapsLib.submitSearch(whereClause, map);
    }
  },
  
  submitSearch: function(whereClause, map, location) {
    //get using all filters
    //NOTE: styleId and templateId are recently added attributes to load custom marker styles and info windows
    //you can find your Ids inside the link generated by the 'Publish' option in Fusion Tables
    //for more details, see https://developers.google.com/fusiontables/docs/v1/using#WorkingStyles 

    //ugh - hack for older fusion tables not having style IDs

    var legacy_fusion_tables = ["1Joj30eltDiXAhbhizuurstPUfqYeSISEmlOANHE", "18LV9PXFVzgP_eZhBRcbsCWRW9sHTMLPaxx3lDa8", "1hq3bK1dUqyE6LCQ488tZF3syQQc5jYsluMS5Fy0"];

    var styleId = 2;
    var templateId = 2;
    for (t in legacy_fusion_tables) {
      if (MapsLib.fusionTableId == legacy_fusion_tables[t]) {
        styleId = 1;
        templateId = 1;
      }

    }

    if (whereClause != '') {
      MapsLib.searchrecords = new google.maps.FusionTablesLayer({
        query: {
          from:   MapsLib.fusionTableId,
          select: MapsLib.locationColumn,
          where:  whereClause
        },
        styleId: styleId,
        templateId: templateId
      });
    }
    else {
      MapsLib.searchrecords = new google.maps.FusionTablesLayer({
        query: {
          from:   MapsLib.fusionTableId,
          select: MapsLib.locationColumn
        },
        styleId: styleId,
        templateId: templateId
      });
    }

    MapsLib.searchrecords.setMap(map);
    MapsLib.uncacheTiles();
  },
  
  clearSearch: function() {
    if (MapsLib.searchrecords != null)
      MapsLib.searchrecords.setMap(null);
    if (MapsLib.addrMarker != null)
      MapsLib.addrMarker.setMap(null);  
    if (MapsLib.searchRadiusCircle != null)
      MapsLib.searchRadiusCircle.setMap(null);
  },
  
  findMe: function() {
    // Try W3C Geolocation (Preferred)
    var foundLocation;
    
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        MapsLib.addrFromLatLng(foundLocation);
      }, null);
    }
    else {
      alert("Sorry, we could not find your location.");
    }
  },
  
  addrFromLatLng: function(latLngPoint) {
    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $('#search_address').val(results[1].formatted_address);
          $('.hint').focus();
          MapsLib.doSearch();
        }
      } else {
        alert("Geocoder failed due to: " + status);
      }
    });
  },
  
  drawSearchRadiusCircle: function(point) {
      var circleOptions = {
        strokeColor: "#4b58a6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: "#4b58a6",
        fillOpacity: 0.05,
        map: map,
        center: point,
        clickable: false,
        zIndex: -1,
        radius: parseInt(MapsLib.searchRadius)
      };
      MapsLib.searchRadiusCircle = new google.maps.Circle(circleOptions);
  },
  
  query: function(selectColumns, whereClause, callback) {
    var queryStr = [];
    queryStr.push("SELECT " + selectColumns);
    queryStr.push(" FROM " + MapsLib.fusionTableId);
    if (whereClause != '')
      queryStr.push(" WHERE " + whereClause);
  
    var sql = encodeURIComponent(queryStr.join(" "));
    $.ajax({url: "https://www.googleapis.com/fusiontables/v1/query?sql="+sql+"&callback="+callback+"&key="+MapsLib.googleApiKey, dataType: "jsonp"});
  },

  queryRaw: function(sql, callback) {
    //console.log(sql);
    $.ajax({url: "https://www.googleapis.com/fusiontables/v1/query?sql="+sql+"&callback="+callback+"&key="+MapsLib.googleApiKey, dataType: "jsonp"});
  },

  handleError: function(json) {
    if (json["error"] != undefined) {
      var error = json["error"]["errors"]
      console.log("Error in Fusion Table call!");
      for (var row in error) {
        console.log(" Domain: " + error[row]["domain"]);
        console.log(" Reason: " + error[row]["reason"]);
        console.log(" Message: " + error[row]["message"]);
      }
    }
  },

  getLastUpdated: function() {
    var sql = "SELECT Datestamp FROM " + MapsLib.fusionTableId + " ORDER BY Datestamp DESC LIMIT 1";
    MapsLib.queryRaw(sql,"MapsLib.displayLastUpdated");
  },
  
  displayLastUpdated: function(json) { 
    MapsLib.handleError(json);
    if (json["rows"] != null) {
      var datestamp = json["rows"][0];
      $( "#last_updated" ).fadeOut(function() {
          $( "#last_updated" ).html("<br />Updated: " + datestamp);
        });
      $( "#last_updated" ).fadeIn();
    }
  },

  getActivePlows: function() {
    var startTime = new Date();
    startTime.setTime(startTime.getTime() + (365 * 24 * -60 * 60 * 1000)); 

    var sql = "SELECT 'Plow ID', Count() FROM " + MapsLib.fusionTableId + " GROUP BY 'Plow ID' ORDER BY Count() DESC";
    MapsLib.queryRaw(sql,"MapsLib.displayActivePlows");
  },
  
  displayActivePlows: function(json) { 
    MapsLib.handleError(json);
    //console.log(json);
    var count = 0;

    if (json["rows"] != null)
      count = json["rows"].length;
    $( "#active_plows" ).fadeOut(function() {
        $( "#active_plows" ).html("Active plows: <strong>" + count + "</strong>/~300");
      });
    $( "#active_plows" ).fadeIn();
  },
  
  addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  },
  
  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
    return decodeURIComponent(text);
  },

  uncacheTiles: function() {
    $("img[src*='googleapis']").each(function(){
      $(this).attr("src",$(this).attr("src")+"&"+(new Date()).getTime());
      //console.log($(this).attr("src"));
    });
  }
}