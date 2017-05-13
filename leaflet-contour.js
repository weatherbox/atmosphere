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
			.attr("d", path);
	},

});



/*
 * StreamlineMaskMercator - specified for Spherical Mercator
 *
 */

function StreamlineMaskMercator (args) {
	this.field = args.field;

	// color
	this.color = args.color;

	// mercator
	this.originPoint = args.originPoint;
	this._scale = 256 * Math.pow(2, args.zoom);
	this._retinaScale = (args.retina) ? 2 : 1;

	// sherical mercator const
	this._R = L.Projection.SphericalMercator.R;
	this._mercatorScale = 0.5 / (Math.PI * this._R);
}

StreamlineMaskMercator.prototype.init = function (width, height, mask) {
	this.width = width;
	this.height = height;
	this.mask = mask;
};

StreamlineMaskMercator.prototype.interpolate = function () {
	this._X = [];
	for (var x = 0; x < this.width; x += 2){
		var lng = this.unprojectLng(x);
		this._X.push(this.field.getDx(lng));
	}

	this.rows = [];
	for (var y = 0; y < this.height; y += 2){
		this._interpolateRow(y);
	}
};

// interpolate each 2x2 pixels
StreamlineMaskMercator.prototype._interpolateRow = function (y) {
	var lat = this.unprojectLat(y);
	var Y = this.field.getDy(lat);

	var row = [];

	for (var x = 0; x < this.width; x += 2){
		var v = this.field.getValueXY(this._X[x/2], Y);

		var color = (v == null) ?
			Streamline.prototype.TRANSPARENT_BLACK :
			this.color(v);

		this.mask.set(x,   y,   color)
		this.mask.set(x+1, y,   color)
		this.mask.set(x,   y+1, color)
		this.mask.set(x+1, y+1, color);
	}

	this.rows[y / 2] = row;
};


StreamlineMaskMercator.prototype.unprojectLat = function (y) {
	var Y = this.originPoint.y + y / this._retinaScale;
	var my = (0.5 - Y / this._scale) / this._mercatorScale;
	var lat = (2 * Math.atan(Math.exp(my / this._R)) - (Math.PI / 2)) * 180 / Math.PI;
	return lat;
};

StreamlineMaskMercator.prototype.unprojectLng = function (x) {
	var X = this.originPoint.x + x / this._retinaScale;
	var mx = (X / this._scale - 0.5) / this._mercatorScale;
	var lng = mx * 180 / Math.PI / this._R;
	return lng;
};



