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

		this._retina = window.devicePixelRatio >= 2;
		this._canvasWidth = (this._retina) ? this._width * 2 : this._width;
		this._canvasHeight = (this._retina) ? this._height * 2 : this._height;

		this._initLayer();

		// first draw
		this._update();
	},

	onRemove: function () {
		this._map.getPanes().overlayPane.removeChild(this._layer);
		this._map.off('viewreset');
		this._map.off('moveend');
	},

	getEvents: function (){
		return {
			viewreset: this._update,
			moveend:   this._update,
			movestart: this._startUpdate,
			zoomStart: this._startZoom,
			zoom:      this._reset,
			zoomanim:  this._animateZoom
		};
	},

	_initLayer: function (){
		this._layer = L.DomUtil.create('div', 'contour-layer');
		this._map.getPanes().overlayPane.appendChild(this._layer);

		var svg = document.createElement("svg");
		svg.style.width = this._width + 'px';
		svg.style.height = this._height + 'px';
		svg.style.position = 'absolute';
		svg.style.top = 0;
		svg.style.left = 0;
		svg.style.zIndex = 4;

		this._layer.appendChild(svg);
	},

	
	_startZoom: function (){
		this._startUpdate();
	},

	_animateZoom: function (e) {
		var scale = this._map.getZoomScale(e.zoom, this.zoom),
			offset = this._map._latLngBoundsToNewLayerBounds(this.bounds, e.zoom, e.center).min;

		this._setLayerCanvasScale(scale);
		L.DomUtil.setPosition(this._layer, offset);
	},

	_reset: function (layer_zoom, origin){
		var zoom = this._map.getZoom();
		var scale = Math.pow(2, zoom - this.zoom);
		var pos = this._map.latLngToLayerPoint(this.origin);
		
		this._setLayerCanvasScale(scale);	
		L.DomUtil.setPosition(this._layer, pos);
	},

	_setLayerCanvasScale: function (scale){
		var self = this;
		this._layerCanvases.forEach(function (canvas){
			canvas.style.width = (self._width * scale) + 'px';
			canvas.style.height = (self._height * scale) + 'px';
		});
	},

	_startUpdate: function (){
		if (!this._updating){
			this._updating = true;
			this.options.onUpdate();
		}
	},

	_endUpdate: function (){
		this._updating = false;
		this.options.onUpdated();
	},

	_update: function (){
		this._startUpdate();

		var bounds = this._map.getBounds(),
			zoom = this._map.getZoom();
		var self = this;

		this.data.getField(bounds, zoom, function (field) {
			self._updateField(field, bounds, zoom);
		});
	},

	_updateField: function (field, bounds, zoom){
		console.log(field);

		var values = field._field;
		var contours = d3.contours().size([field._fnx, field._fny]);
		var path = d3.geoPath();

		d3.select("svg")
			.attr("stroke", "#fff")
			.attr("stroke-width", 0.5)
			.attr("stroke-linejoin", "round")
		.selectAll("path")
			.data(contours(values))
			.enter().append("path")
			.attr("d", path);
	},
});

L.contour = function() {
	return new L.Contour();
};


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



