
// cons creates const varaible , its a JS keyword. map is now a object represnting our map. new ol.Map()
//creates new object 
const map = new ol.Map({
    target: 'map', 
    layers: [
        new ol.layer.Tile({
            source: new ol.source.OSM()
        })
    ],
    view: new ol.View({
        center: ol.proj.fromLonLat([72.877, 19.0760]), //Mumbai
        zoom: 10
        })
});