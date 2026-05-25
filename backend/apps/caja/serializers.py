from rest_framework import serializers
from .models import ArqueoCaja, MovimientoCaja, GastoFijo, GastoExtra


class MovimientoCajaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoCaja
        fields = ['id', 'descripcion', 'importe', 'orden']


class ArqueoCajaSerializer(serializers.ModelSerializer):
    movimientos      = MovimientoCajaSerializer(many=True, required=False)
    registrado_por_nombre = serializers.SerializerMethodField()
    total_ingresos   = serializers.SerializerMethodField()
    total_egresos    = serializers.SerializerMethodField()

    class Meta:
        model  = ArqueoCaja
        fields = [
            'id', 'fecha', 'sede', 'saldo_inicial',
            'cant_20000', 'cant_10000', 'cant_2000', 'cant_1000',
            'cant_500', 'cant_200', 'cant_100',
            'total_billetes', 'saldo_final', 'diferencia',
            'notas', 'fecha_registro', 'registrado_por_nombre',
            'movimientos', 'total_ingresos', 'total_egresos', 'queda_en_caja',
        ]
        read_only_fields = ['total_billetes', 'saldo_final', 'diferencia',
                            'fecha_registro', 'registrado_por_nombre',
                            'total_ingresos', 'total_egresos']

    def get_registrado_por_nombre(self, obj):
        if obj.registrado_por:
            return obj.registrado_por.get_full_name() or obj.registrado_por.username
        return None

    def get_total_ingresos(self, obj):
        return round(float(sum(
            m.importe for m in obj.movimientos.all() if m.importe > 0
        )), 2)

    def get_total_egresos(self, obj):
        return round(float(sum(
            abs(m.importe) for m in obj.movimientos.all() if m.importe < 0
        )), 2)

    def create(self, validated_data):
        movimientos_data = validated_data.pop('movimientos', [])
        arqueo = ArqueoCaja.objects.create(**validated_data)
        for i, mov in enumerate(movimientos_data):
            mov.pop('orden', None)
            MovimientoCaja.objects.create(arqueo=arqueo, orden=i, **mov)
        arqueo.calcular_total_billetes()
        arqueo.saldo_final = (
            arqueo.saldo_inicial
            + arqueo.total_billetes
            + sum(m.importe for m in arqueo.movimientos.all())
        )
        arqueo.diferencia  = arqueo.total_billetes - (
            arqueo.saldo_inicial + sum(
                m.importe for m in arqueo.movimientos.all() if m.importe > 0
            )
        )
        arqueo.save()
        return arqueo

    def update(self, instance, validated_data):

        movimientos_data = validated_data.pop('movimientos', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if movimientos_data is not None:
            instance.movimientos.all().delete()
            for i, mov in enumerate(movimientos_data):
                mov.pop('orden', None)
                MovimientoCaja.objects.create(arqueo=instance, orden=i, **mov)

        instance.calcular_total_billetes()
        instance.saldo_final = (
            instance.saldo_inicial
            + instance.total_billetes
            + sum(m.importe for m in instance.movimientos.all())
        )
        instance.diferencia = instance.total_billetes - (
            instance.saldo_inicial + sum(
                m.importe for m in instance.movimientos.all() if m.importe > 0
            )
        )
        instance.save()
        return instance


class GastoFijoSerializer(serializers.ModelSerializer):
    concepto_label = serializers.SerializerMethodField()

    class Meta:
        model  = GastoFijo
        fields = ['id', 'mes', 'sede', 'concepto', 'concepto_label', 'importe', 'fecha', 'notas']

    def get_concepto_label(self, obj):
        return obj.get_concepto_display()


class GastoExtraSerializer(serializers.ModelSerializer):
    total = serializers.SerializerMethodField()

    class Meta:
        model  = GastoExtra
        fields = ['id', 'mes', 'sede', 'concepto', 'precio_unitario', 'cantidad', 'total', 'fecha', 'notas']

    def get_total(self, obj):
        return round(float(obj.precio_unitario * obj.cantidad), 2)
