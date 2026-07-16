from rest_framework import serializers
from .models import Producto, Venta, VentaItem, MovimientoCuentaCorriente, MovimientoStock, DEPOSITO


class ProductoSerializer(serializers.ModelSerializer):
    categoria_label = serializers.SerializerMethodField()
    stock_total     = serializers.SerializerMethodField()
    stock_ubic      = serializers.SerializerMethodField()  # {ubicacion: cantidad}
    costo           = serializers.SerializerMethodField()   # último costo unitario
    margen          = serializers.SerializerMethodField()   # precio - costo

    class Meta:
        model  = Producto
        fields = [
            'id', 'nombre', 'categoria', 'categoria_label', 'precio',
            'stock_ubic', 'stock_total', 'costo', 'margen', 'activo',
        ]

    # El stock/costo se inyectan por contexto desde la vista (cálculo en lote)
    def _stock(self, obj):
        return (self.context.get('stock_map') or {}).get(obj.id, {})

    def get_categoria_label(self, obj):
        return obj.get_categoria_display()

    def get_stock_ubic(self, obj):
        return self._stock(obj)

    def get_stock_total(self, obj):
        return sum(self._stock(obj).values())

    def get_costo(self, obj):
        return (self.context.get('costo_map') or {}).get(obj.id)

    def get_margen(self, obj):
        c = self.get_costo(obj)
        return float(obj.precio) - c if c is not None else None


class MovimientoStockSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.SerializerMethodField()
    tipo_label      = serializers.SerializerMethodField()

    class Meta:
        model  = MovimientoStock
        fields = [
            'id', 'producto', 'producto_nombre', 'fecha', 'tipo', 'tipo_label',
            'cantidad', 'origen', 'destino', 'costo_unitario', 'proveedor', 'notas', 'creado',
        ]
        read_only_fields = ['creado']

    def get_producto_nombre(self, obj):
        return obj.producto.nombre

    def get_tipo_label(self, obj):
        return obj.get_tipo_display()

    def validate(self, data):
        tipo = data.get('tipo')
        if data.get('cantidad', 0) <= 0:
            raise serializers.ValidationError({'cantidad': 'Debe ser mayor a 0.'})
        # Normalizar origen/destino según el tipo
        if tipo == 'ingreso':
            data['origen'] = ''
            data['destino'] = DEPOSITO
        elif tipo == 'envio':
            data['origen'] = DEPOSITO
            if not data.get('destino'):
                raise serializers.ValidationError({'destino': 'Elegí la sucursal destino.'})
        elif tipo == 'ajuste':
            if not (data.get('origen') or data.get('destino')):
                raise serializers.ValidationError('El ajuste necesita una ubicación.')
        return data


class VentaItemReadSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.SerializerMethodField()
    subtotal        = serializers.SerializerMethodField()

    class Meta:
        model  = VentaItem
        fields = ['id', 'producto', 'producto_nombre', 'cantidad', 'precio_unitario', 'subtotal']

    def get_producto_nombre(self, obj):
        return obj.producto.nombre

    def get_subtotal(self, obj):
        return float(obj.precio_unitario * obj.cantidad)


class VentaItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VentaItem
        fields = ['producto', 'cantidad', 'precio_unitario']


class VentaSerializer(serializers.ModelSerializer):
    items         = VentaItemReadSerializer(many=True, read_only=True)
    items_write   = VentaItemWriteSerializer(many=True, write_only=True, source='items')
    alumno_nombre = serializers.SerializerMethodField()
    metodo_label  = serializers.SerializerMethodField()

    class Meta:
        model  = Venta
        fields = [
            'id', 'fecha', 'alumno', 'alumno_nombre', 'comprador_nombre',
            'sede', 'metodo_pago', 'metodo_label', 'total', 'notas',
            'items', 'items_write',
        ]

    def get_alumno_nombre(self, obj):
        if obj.alumno:
            return f"{obj.alumno.nombre} {obj.alumno.apellido}"
        return obj.comprador_nombre or 'Externo'

    def get_metodo_label(self, obj):
        return obj.get_metodo_pago_display()

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        venta = Venta.objects.create(**validated_data)
        sede  = venta.sede  # '107' o '24'

        for item_data in items_data:
            producto = item_data['producto']
            cantidad = item_data['cantidad']
            precio_u = item_data.get('precio_unitario', producto.precio)

            VentaItem.objects.create(
                venta=venta,
                producto=producto,
                cantidad=cantidad,
                precio_unitario=precio_u,
            )

            # Registrar la salida de stock de la sede en el libro de movimientos
            MovimientoStock.objects.create(
                producto=producto, fecha=venta.fecha, tipo='venta',
                cantidad=cantidad, origen=sede, destino='',
                venta=venta, registrado_por=venta.registrado_por,
            )

        if venta.metodo_pago == 'cuenta_corriente' and venta.alumno_id:
            MovimientoCuentaCorriente.objects.create(
                alumno_id=venta.alumno_id,
                fecha=venta.fecha,
                tipo='cargo',
                monto=venta.total,
                descripcion=f"Venta #{venta.id}",
                venta=venta,
            )

        return venta


class MovimientoCCSerializer(serializers.ModelSerializer):
    tipo_label = serializers.SerializerMethodField()

    class Meta:
        model  = MovimientoCuentaCorriente
        fields = ['id', 'fecha', 'tipo', 'tipo_label', 'monto', 'descripcion', 'venta']

    def get_tipo_label(self, obj):
        return obj.get_tipo_display()
