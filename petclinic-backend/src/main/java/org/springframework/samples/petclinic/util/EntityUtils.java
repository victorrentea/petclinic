package org.springframework.samples.petclinic.util;

import org.springframework.orm.ObjectRetrievalFailureException;

import java.util.Collection;

public abstract class EntityUtils {

    public static <T> T getById(Collection<T> entities, Class<T> entityClass, int entityId)
        throws ObjectRetrievalFailureException {
        for (T entity : entities) {
            // get the id field via reflection (temporary workaround for generics)
            int id;
            try {
                id = (int) entityClass.getMethod("getId").invoke(entity);
            } catch (Exception e) {
                throw new ObjectRetrievalFailureException("Could not access getId method on " + entityClass.getName(), e);
            }
            if (id == entityId && entityClass.isInstance(entity)) {
                return entity;
            }
        }
        throw new ObjectRetrievalFailureException(entityClass, entityId);
    }

}
