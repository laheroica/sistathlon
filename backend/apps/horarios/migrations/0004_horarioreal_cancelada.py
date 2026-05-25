from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('horarios', '0003_alter_horariomaestro_disciplina_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='horarioreal',
            name='cancelada',
            field=models.BooleanField(default=False, help_text='La clase no se dictó ese día'),
        ),
    ]
