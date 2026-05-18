Contexto
El objetivo es desarrollar una aplicación (o conjunto de ellas) para realizar el seguimiento de la facturación a clientes de una consultora. El sistema debe permitir el registro de clientes, proyectos, empleados asignados y las horas dedicadas por el personal.
Además, el sistema debe generar un informe de facturación mensual final una vez que el responsable del proyecto haya cerrado y aprobado todos los registros de tiempo.
________________________________________
Requisitos de Negocio
La aplicación debe adherirse a las siguientes especificaciones funcionales:
Premisas Generales:
•	La facturación se organiza por proyecto; cada proyecto corresponde a un único cliente.
•	La empresa factura en función de las horas trabajadas por cada empleado.
•	Cada empleado tiene una tarifa basada en su categoría. Inicialmente, se definen cuatro categorías: Junior, Mid-level, Senior y Lead. Cada categoría tiene una tarifa estándar global. Para las pruebas, se puede asumir que son 20, 30, 40 y 50€ respectivamente. En caso de que se decida otra tarifa, esta debe ser fácilmente modificable.
•	Cada proyecto tiene un Manager Responsable designado.
•	Debe existir un rol de Administrador (Admin) con permisos especiales para modificar todas las entidades.
Funcionalidades Específicas:
Empleados:
•	Deben poder registrar las horas incurridas por proyecto y fecha.
•	Pueden revisar el total de horas dedicadas a cada proyecto.
•	Límite: No se pueden registrar más de 8 horas por día. No se puede fichar los sábados y domingos.
•	Un empleado solo puede registrar horas en los proyectos a los que esté asignado.
•	Flujo de trabajo: Los registros de tiempo se crean como "provisionales". Al final del mes, el empleado debe enviarlos todos para la aprobación del manager. Una vez enviados, no puede añadir más horas para ese mes.
•	No puede registrar horas en un mes que no sea el actual.
•	Visibilidad: Necesitan ver sus registros mensuales categorizados por proyecto y estado.
Proyectos:
•	Vinculados a un único manager y a un único cliente.
•	Contienen los registros de tiempo asignados y un presupuesto monetario, el cual es modificable por el manager responsable.
•	El manager puede marcarlos como "cerrados". Una vez cerrados, no se permiten más registros de horas.
Managers:
•	Pueden asignar empleados a los proyectos que gestionan. Los managers se incluyen automáticamente en sus propios proyectos y pueden registrar horas. Se les asigna la tarifa "Lead" por defecto.
•	Creación: Los managers generan los proyectos. Los proyectos se vinculan automáticamente al manager que los crea y este tiene que aportar un cliente de la lista dada de alta para el proyecto. Los clientes son entidades independientes y pueden ser reutilizados por diferentes managers.
•	Analíticas: Deben poder ver un desglose del gasto (monetario) frente al presupuesto, el coste medio por hora, el total de horas incurridas y las horas incurridas por nivel de perfil. Esto debe poder calcularse por proyecto.
•	Aprobación: Deben revisar las horas enviadas por los empleados asignados cada mes para aprobarlas o rechazarlas. Para cada proyecto en la vista de aprobación tiene que poder ver el consumo de presupuesto actual y el proyectado en base a las horas pendientes de aprobar. Al aprobar por empleado, el manager debería poder ver el presupuesto restante del proyecto al aprobarlas. Solo las horas aprobadas se incluyen en el desglose financiero. Si se rechazan, ya no se pueden añadir y no cuentan para la facturación.
Clientes:
•	Deben incluir datos de contacto (por ejemplo, un correo electrónico de referencia) y el nombre del cliente.
•	Solo los pueden crear los Administradores
Notificaciones / Recordatorios:
•	Proceso en segundo plano: El día 25 de cada mes, se envía un recordatorio automático a los empleados para que envíen sus imputaciones antes de que termine el mes.
•	El día 1 de cada mes, los managers reciben un resumen de las hojas de tiempo pendientes de sus proyectos.
•	Informe Final: Una vez que los proyectos de un cliente para el mes anterior están totalmente cerrados (sin revisiones pendientes de registros, todos están aprobados o enviados), se envía un informe de gasto total (monetario) al correo del cliente y desglosado por proyecto. El mensaje debe incluir el nombre del cliente.
•	Pista: Para esto, puede ser una buena idea revisar la funcionalidad de cds.spawn y server.js
•	Pista: Para enviar mails, se puede utilizar alguna API que tenga versión gratuita, por ejemplo Sendgrid.
Extras - Solo si se termina el resto y se considera terminado
•	Añadir para empleados y managers las notificaciones y recordatorios por workzone.
•	Añadir calendario a app ui5 de fichajes de empleados marcando los días fichados y los vacíos.
•	Añadir lógica para horas extra con comentario justificativo obligatorio.
•	Añadir vista para admins de log de modificación de campos importantes de clientes, proyectos, etc.
•	Frontend para administradores para edición general
________________________________________
Directrices y Premisas del Proyecto
•	Diseño: Se espera un papel proactivo en la definición del modelo de datos, los campos, las relaciones entre entidades y las validaciones requeridas para asegurar una lógica consistente. Lo mismo aplica al diseño de las aplicaciones frontend.
•	Control de versiones: Se esperan commits regulares e indicando las modificaciones realizadas.
•	Documentación: Utiliza el README.md para especificar las configuraciones necesarias del proyecto y cualquier suposición realizada sobre la lógica de negocio no definida explícitamente.
•	Calidad del Código: El objetivo es lograr un código limpio, modularizado y testable siguiendo las buenas prácticas indicadas en el manual que se ha proporcionado.
•	Uso del Framework: Aprovecha las herramientas y características nativas del framework para gestionar restricciones y operaciones. Prioriza estas sobre la lógica a medida en JavaScript para reducir errores.
•	Pruebas (Testing): Se valorará positivamente la realización de pruebas automatizadas que aseguren la integridad de la lógica central. Indica cualquier indicación específica de testing en el README.md.
•	Arquitectura: Favorece servicios y recursos específicos para cada caso de uso en lugar de centralizar toda la lógica en un único módulo complejo.
•	Enfoque: El interés principal es la lógica del backend y una gestión de roles robusta. El frontend puede ser sencillo siempre que cumpla con las funcionalidades básicas requeridas.
•	Rol de Admin: Aunque una interfaz dedicada para el Admin es bienvenida, es suficiente con que el Admin pueda modificar datos mediante llamadas directas al backend/API salvo en los casos específicamente indicados en los requisitos.
•	Mejoras: Cualquier mejora detectada o funcionalidad extra es bienvenida (documéntalas en el README.md).

