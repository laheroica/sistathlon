from django.db import models
from django.utils import timezone


class Sede(models.TextChoices):
    ATHLON_107 = '107', 'Athlon 107'
    ATHLON_24 = '24', 'Athlon 24'


class Disciplina(models.TextChoices):
    CROSSFIT = 'CF', 'Crossfit'
    HEAVY_FUNCIONAL = 'HF', 'Heavy Funcional'
    HYROX = 'HX', 'Hyrox'
    TEENS = 'TN', 'Crossfit Teens'
    KIDS = 'KD', 'Crossfit Kids'
    BONUS = 'BP', 'Bonus Pack'
    FULLBODY = 'FB', 'FullBody'


class Pertenencia(models.TextChoices):
    ATHLON = 'athlon', 'Athlon'
    DAY = 'day', 'Day Gym'
    OTRO = 'otro', 'Otro espacio'


class Frecuencia(models.TextChoices):
    DOS_X = '2x', '2 veces por semana'
    TRES_X = '3x', '3 veces por semana'
    CINCO_X = '5x', '5 veces por semana'
    PASE_LIBRE = 'libre', 'Pase Libre'


class TipoPrecio(models.TextChoices):
    REGULAR = 'regular', 'Regular (1–10)'
    UNLPAM = 'unlpam', 'UNLPam (1–10)'
    DESPUES_10 = 'despues_10', 'Después del día 10'


class EstadoAlumno(models.TextChoices):
    ACTIVO = 'activo', 'Activo'
    MORA = 'mora', 'En mora'
    BAJA = 'baja', 'Baja'
    ALEJADO = 'alejado', 'Alejado'
    TEMPORAL = 'temporal', 'Temporal'


class ComboTipo(models.TextChoices):
    NINGUNO = '', 'Sin combo'
    HYROX_CF = 'hyrox_cf', 'Combo Hyrox + CF'
    HYROX_HF = 'hyrox_hf', 'Combo Hyrox + HF'


class Alumno(models.Model):
    # Datos personales
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    dni = models.CharField(max_length=20, unique=True)
    celular = models.CharField(max_length=30)
    email = models.EmailField(blank=True, null=True)
    instagram = models.CharField(max_length=100, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)

    # Pertenencia y actividad
    sede = models.CharField(max_length=10, choices=Sede.choices)
    fecha_inicio = models.DateField()
    disciplina = models.CharField(max_length=5, choices=Disciplina.choices)
    frecuencia = models.CharField(max_length=10, choices=Frecuencia.choices)
    combo = models.CharField(max_length=20, choices=ComboTipo.choices, default='', blank=True)
    bonus_pack = models.BooleanField(default=False)
    horario       = models.CharField(max_length=20, blank=True)
    horario_combo = models.CharField(max_length=20, blank=True,
        help_text='Horario de la disciplina combo (ej: Hyrox). Solo aplica cuando combo != ""')

    # Pertenencia (espacio que gestiona al alumno)
    pertenencia = models.CharField(max_length=10, choices=Pertenencia.choices, default=Pertenencia.ATHLON)
    porcentaje_athlon = models.DecimalField(max_digits=5, decimal_places=2, default=100,
        help_text='% del cobro que queda en Athlon (100 = Athlon, 50 = Day)')

    # Cuota
    tipo_precio = models.CharField(max_length=20, choices=TipoPrecio.choices, default=TipoPrecio.REGULAR)
    cuota_actual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    precio_especial = models.BooleanField(default=False)
    motivo_precio_especial = models.CharField(max_length=200, blank=True, default='')

    # Estado (calculado, pero almacenado para performance)
    estado = models.CharField(max_length=20, choices=EstadoAlumno.choices, default=EstadoAlumno.ACTIVO)

    # Metadata
    activo = models.BooleanField(default=True)
    notas = models.TextField(blank=True, null=True)
    fecha_alta = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Alumno'
        verbose_name_plural = 'Alumnos'
        ordering = ['apellido', 'nombre']

    def __str__(self):
        return f"{self.apellido}, {self.nombre} ({self.sede})"

    @property
    def nombre_completo(self):
        return f"{self.nombre} {self.apellido}"

    def calcular_estado(self):
        """Recalcula el estado según el último pago registrado."""
        ultimo_pago = self.pagos.order_by('-fecha_pago').first()
        if not ultimo_pago:
            return EstadoAlumno.ALEJADO
        dias_sin_pagar = (timezone.now().date() - ultimo_pago.fecha_pago).days
        if dias_sin_pagar <= 30:
            return EstadoAlumno.ACTIVO
        elif dias_sin_pagar <= 60:
            return EstadoAlumno.BAJA
        else:
            return EstadoAlumno.ALEJADO

    def dias_hasta_vencimiento(self):
        """Días restantes del mes actual (REST. en los Excel)."""
        hoy = timezone.now().date()
        import calendar
        ultimo_dia = calendar.monthrange(hoy.year, hoy.month)[1]
        vencimiento = hoy.replace(day=ultimo_dia)
        return (vencimiento - hoy).days


# ── Configuración dinámica de disciplinas ──────────────────────────────────────

class DiscipConfig(models.Model):
    """Catálogo editable de disciplinas. Reemplaza los TextChoices hardcodeados."""
    codigo      = models.CharField(max_length=10, unique=True,
                                   help_text='Código corto: CF, HF, HX, FB…')
    nombre      = models.CharField(max_length=50)
    frecuencias = models.JSONField(default=list,
                                   help_text='Ej: ["2x","3x","libre"]')
    color_badge = models.CharField(max_length=150,
                                   default='bg-gray-700 text-gray-200',
                                   help_text='Clases Tailwind para el badge')
    color_hex   = models.CharField(max_length=20, default='#6b7280',
                                   help_text='Color hex para gráficos')
    orden       = models.PositiveIntegerField(default=0)
    activo      = models.BooleanField(default=True)

    class Meta:
        ordering            = ['orden', 'nombre']
        verbose_name        = 'Disciplina'
        verbose_name_plural = 'Disciplinas'

    def __str__(self):
        return f"{self.codigo} — {self.nombre}"


# ── Configuración del negocio (singleton, despersonalizable) ────────────────────

class NegocioConfig(models.Model):
    """
    Configuración global del negocio. Es un singleton (siempre pk=1) para poder
    despersonalizar el sistema: nombre, ciudad y logos configurables sin tocar código.
    Los logos se guardan como data URI base64 (persisten sin depender del filesystem).
    """
    nombre      = models.CharField(max_length=100, default='Athlon')
    ciudad      = models.CharField(max_length=120, blank=True, default='General Pico, La Pampa')
    logo_claro  = models.TextField(blank=True, help_text='Logo para fondo oscuro (sistema). Data URI base64.')
    logo_oscuro = models.TextField(blank=True, help_text='Logo para fondo claro (PDFs). Data URI base64.')

    class Meta:
        verbose_name        = 'Configuración del negocio'
        verbose_name_plural = 'Configuración del negocio'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Config: {self.nombre}"
