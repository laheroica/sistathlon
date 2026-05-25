from rest_framework import serializers
from .models import Producto, Venta, VentaItem, MovimientoCuentaCorriente


class ProductoSerializer(serializers.ModelSerializer):
    categoria_label = serializers.SerializerMethodField()

    class Meta:
        model  = Producto
        fields = ['id', 'nombre', 'categoria', 'categoria_label', 'precio', 'stock', 'activo']

    def get_categoria_label(self, obj):
        return obj.get_categoria_display()


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
            producto.stock = max(0, producto.stock - cantidad)
            producto.save(update_fields=['stock'])

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
