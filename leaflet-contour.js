/*
 * @class L.Contour
 * @inherits L.Layer
 * @author Yuta Tachibana
 *
 * for leaflet v1.0
 *
 * requirements:
 */

L.Contour = L.Layer.extend({
	options: {
		onUpdate: function (){},
		onUpdated: function (){}
	},

	initialize: function (data, options) {
		L.setOptions(this, options);
		this.data = data;
	},

	onAdd: function (map) {
		this._map = map;
		this._width  = map.getSize().x;	
		this._height = map.getSize().y;

		this._initLayer();

		// first draw
		this._update();
	},

	onRemove: function () {
		this._map.getPanes().overlayPane.removeChild(this._layer);
	},

	getEvents: function (){
		return {
			moveend:   this._update,
		};
	},

	_initLayer: function (){
		L.svg().addTo(this._map);
		this._svg = d3.select("#map").select("svg");
	},

	_update: function (){
		var bounds = this._map.getBounds(),
			zoom = this._map.getZoom();
		var self = this;

		this.data.getField(bounds, zoom, function (field) {
			self._updateField(field, bounds, zoom);
		});
	},

	_updateField: function (field, bounds, zoom){
		console.log(field);
		console.time("create contour");

		var map = this._map;
		function projectPoint (x, y){
			var lat = field._p0.lat - field._dlat * y;
			var lon = field._p0.lng + field._dlng * x;
			var point = map.latLngToLayerPoint(new L.LatLng(lat, lon));
			this.stream.point(point.x, point.y);
		}

		var values = field._field;
		var contours = d3.contours().size([field._fnx, field._fny]);
		var transform = d3.geoTransform({point: projectPoint});
		var path = d3.geoPath().projection(transform);

		this._svg
			.attr("stroke", "#fff")
			.attr("stroke-width", 0.5)
			.attr("stroke-linejoin", "round")
		.selectAll("path")
			.data(contours(values))
			.enter().append("path")
			.attr("fill", "none")
			.attr("value", function(d){ console.log(d.value); return d.value; })
			.attr("d", path);

		console.timeEnd("create contour");
	},

});


